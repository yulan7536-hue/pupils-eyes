import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dns from 'node:dns';
import net from 'node:net';
import https from 'node:https';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import type {IncomingMessage, ServerResponse} from 'node:http';

/**
 * 豆包 / 火山方舟转发代理（本地开发用）。
 *
 * 火山方舟所有接口（图生图 / Seed3D / TOS 下载）都没有 CORS 头，浏览器无法直连，
 * 所以在 dev server 上挂同源代理。线上部署改用 server.js（express 一体服务），
 * 路径与这里保持一致：/generate、/task、/download。
 *
 * 只放行火山方舟相关域名，避免变成任意 URL 的开放代理（SSRF）。
 */
/** 生图接口地址固定，直接写死，不走 url 参数 */
const ARK_GENERATE_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
/** Seed3D 任务接口（创建 / 查询） */
const ARK_TASK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
const ALLOWED_HOSTS = [
  /(^|\.)tos-cn-beijing\.volces\.com$/i,
  /^ark\.cn-beijing\.volces\.com$/i,
];
/** 模型 zip 约 16MB，留足余量但不无限 */
const MAX_BYTES = 120 * 1024 * 1024;
/** 本代理响应的路径 */
const API_PATHS = ['/generate', '/task', '/download'];

/**
 * 绕过本机 fake-ip 的 DNS。
 *
 * 很多人本机开着 Clash / Surge 一类的代理，DNS 会被接管成 fake-ip
 * （ark.cn-beijing.volces.com → 198.18.x.x）。浏览器走代理规则能通，
 * 但 Node 直连这个假 IP 必然超时，dev 中间件就一直 `fetch failed`，
 * 「照片变贴纸」的 AI 重绘永远回落成纯抠图。
 *
 * 这里用阿里 DoH（直接连 223.5.5.5 的 443，不依赖系统 DNS）拿真实 IP，
 * 只用于方舟转发；DoH 不可用时自动回退系统 DNS，线上没有 fake-ip 也照常工作。
 */
const dohCache = new Map<string, { ip: string; exp: number }>();

function resolveViaDoh(hostname: string): Promise<string | null> {
  const cached = dohCache.get(hostname);
  if (cached && cached.exp > Date.now()) return Promise.resolve(cached.ip);

  return new Promise((resolve) => {
    const req = https.request(
      {
        host: '223.5.5.5',
        port: 443,
        path: `/resolve?name=${encodeURIComponent(hostname)}&type=A`,
        servername: 'dns.alidns.com',
        rejectUnauthorized: false,
        method: 'GET',
        timeout: 4000,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const j = JSON.parse(body) as { Answer?: { type: number; data: string }[] };
            const ans = (j.Answer ?? []).find((a) => a.type === 1);
            if (ans?.data) {
              dohCache.set(hostname, { ip: ans.data, exp: Date.now() + 60_000 });
              resolve(ans.data);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

/**
 * 转发时用的 DNS 解析：优先 DoH 真实 IP，拿不到就用系统 DNS。
 *
 * 直接交给 `https.request` 的 lookup 选项，不用 undici —— 少一个依赖，
 * 也避免 undici 8 要求 Node ≥ 22.19 而在构建机上加载失败。
 */
const dohLookup = (
  hostname: string,
  options: dns.LookupOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family: number
  ) => void
) => {
  const fallback = () => dns.lookup(hostname, options, callback);

  void resolveViaDoh(hostname)
    .then((ip) => {
      // 只认合法 IPv4，DoH 偶发返回空/异常时立刻回退
      if (ip && net.isIPv4(ip)) callback(null, ip, 4);
      else fallback();
    })
    .catch(fallback);
};

function arkProxy(serverKey: string): Plugin {
  const handler = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void
  ) => {
    const reqUrl = new URL(req.url ?? '/', 'http://localhost');

    // 前端问「服务端有没有配 Key」——和 server.js 的 /ai-status 保持一致
    if (reqUrl.pathname === '/ai-status') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ configured: Boolean(serverKey) }));
      return;
    }

    if (!API_PATHS.includes(reqUrl.pathname)) return next();

    let target = '';
    if (reqUrl.pathname === '/generate') {
      target = ARK_GENERATE_ENDPOINT;
    } else if (reqUrl.pathname === '/task') {
      // Seed3D 任务：POST 创建（无 id）/ GET 查询（?id=xxx）
      const taskId = reqUrl.searchParams.get('id') ?? '';
      target = taskId ? `${ARK_TASK_ENDPOINT}/${taskId}` : ARK_TASK_ENDPOINT;
    } else if (reqUrl.pathname === '/download') {
      target = reqUrl.searchParams.get('url') ?? '';
    }

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      res.statusCode = 400;
      res.end('bad url');
      return;
    }
    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.some((re) => re.test(parsed.hostname))) {
      res.statusCode = 403;
      res.end('host not allowed');
      return;
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 90_000);
    try {
      // 转发 method / body：豆包的生图接口是 POST，而且浏览器直连会被 CORS 拦
      const method = (req.method ?? 'GET').toUpperCase();
      let body: Buffer | undefined;
      if (method !== 'GET' && method !== 'HEAD') {
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of req) {
          total += (chunk as Buffer).length;
          if (total > MAX_BYTES) {
            res.statusCode = 413;
            res.end('too large');
            return;
          }
          chunks.push(chunk as Buffer);
        }
        body = Buffer.concat(chunks);
      }

      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (!v || ['host', 'content-length', 'connection', 'origin', 'referer'].includes(k)) continue;
        headers[k] = Array.isArray(v) ? v.join(',') : v;
      }
      // 强制上游返回未压缩，否则 gzip body 透传缺 Content-Encoding，前端解析失败
      headers['accept-encoding'] = 'identity';
      // 与服务端一致：配了 Key 就用服务端的，前端不必也不该持有
      if (serverKey && /^ark\.cn-beijing\.volces\.com$/i.test(parsed.hostname)) {
        headers.authorization = `Bearer ${serverKey}`;
      }

      // 用原生 https.request（不走 undici），lookup 里做 DoH 兜底
      const upstream = await new Promise<{
        status: number;
        headers: Record<string, string | string[] | undefined>;
        body: Buffer;
      }>((resolve, reject) => {
        const upReq = https.request(
          parsed,
          {
            method,
            headers,
            timeout: 90_000,
            lookup: dohLookup as never,
          },
          (upRes) => {
            const chunks: Buffer[] = [];
            let total = 0;
            upRes.on('data', (c: Buffer) => {
              total += c.length;
              if (total > MAX_BYTES) {
                upReq.destroy(new Error('upstream too large'));
                return;
              }
              chunks.push(c);
            });
            upRes.on('end', () =>
              resolve({
                status: upRes.statusCode ?? 502,
                headers: upRes.headers,
                body: Buffer.concat(chunks),
              })
            );
            upRes.on('error', reject);
          }
        );
        upReq.on('error', reject);
        upReq.on('timeout', () => upReq.destroy(new Error('upstream timeout')));
        ac.signal.addEventListener('abort', () => upReq.destroy(new Error('aborted')));
        if (body) upReq.write(body);
        upReq.end();
      });

      if (upstream.status >= 400) {
        res.statusCode = upstream.status;
        // 把上游的错误体透传回去，前端才能看清是欠费还是参数错
        res.setHeader('Content-Type', 'application/json');
        res.end(upstream.body.toString('utf8') || `upstream ${upstream.status}`);
        return;
      }
      const len = upstream.headers['content-length'];
      if (len && Number(len) > MAX_BYTES) {
        res.statusCode = 413;
        res.end('too large');
        return;
      }
      res.statusCode = 200;
      const ct = upstream.headers['content-type'];
      res.setHeader('Content-Type', (Array.isArray(ct) ? ct[0] : ct) ?? 'application/octet-stream');
      res.setHeader('Content-Length', String(upstream.body.byteLength));
      res.setHeader('Cache-Control', 'no-store');
      res.end(upstream.body);
    } catch (err) {
      const e = err as Error & { cause?: { code?: string; message?: string } };
      // 线上只报一句，本地把 cause 打全 —— 否则 "fetch failed" 等于没说
      console.error('[ark-proxy]', e.message, e.cause?.code, e.cause?.message);
      res.statusCode = 502;
      res.end(`proxy failed: ${e.message} | ${e.cause?.code ?? ''} ${e.cause?.message ?? ''}`);
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    name: 'ark-tos-proxy',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

/**
 * 剔掉 onnxruntime 自带的 WebGPU 版 wasm。
 *
 * 抠图库内部用 `new URL('...jsep.wasm', import.meta.url)` 引了这个 23MB 文件，
 * Vite 会把它们一并复制进 dist。但我们走 cpu 后端，而且 wasmPaths 已经被
 * 显式指向 /rembg/（同源托管的那一份），这个文件永远不会被加载。
 */
function dropOrtJsepWasm(): Plugin {
  return {
    name: 'drop-ort-jsep-wasm',
    generateBundle(_options, bundle) {
      for (const key of Object.keys(bundle)) {
        if (/ort-wasm-simd-threaded\.jsep.*\.wasm$/i.test(key)) delete bundle[key];
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  /**
   * 豆包 Key 从 .env.local 读，只交给 dev 中间件，不进 bundle。
   * （VITE_ 前缀的变量会被注入 import.meta.env，等于公开，所以优先用
   *   DOUBAO_API_KEY，VITE_ 那个只作兼容旧配置。）
   */
  const env = loadEnv(mode, process.cwd(), '');
  const serverKey = (env.DOUBAO_API_KEY || env.VITE_DOUBAO_API_KEY || '').trim();
  /**
   * 同一份 dist 要能挂在两种地方：
   * - GitHub Pages 项目站点，前缀 /pupils-eyes/
   * - 云端应用域名，直接吃根路径 /
   * 写死任何一边，另一边就会 404 白屏。用相对路径两边都成立 ——
   * 这个应用是纯 hash 路由（#note / #album），文档路径不会变，相对的 ./assets 解析得住。
   * 真要覆盖还可以用 VITE_BASE 指定。
   */
  const base = process.env.VITE_BASE ?? (command === 'build' ? './' : '/');

  return {
    base,
    plugins: [react(), tailwindcss(), arkProxy(serverKey), dropOrtJsepWasm()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // 云端发布走反向代理，Host 头不是 localhost，Vite 默认会拦下来
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
