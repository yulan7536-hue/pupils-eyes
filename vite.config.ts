import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dns from 'node:dns';
import https from 'node:https';
import {Agent, fetch as undiciFetch} from 'undici';
import {defineConfig, type Plugin} from 'vite';
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

/** 转发用 agent：优先 DoH 真实 IP，拿不到就用系统 DNS */
const arkAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      void resolveViaDoh(hostname)
        .then((ip) => {
          if (ip) callback(null, ip, 4);
          else dns.lookup(hostname, options, callback);
        })
        .catch(() => dns.lookup(hostname, options, callback));
    },
  },
});

function arkProxy(): Plugin {
  const handler = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void
  ) => {
    const reqUrl = new URL(req.url ?? '/', 'http://localhost');
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

      const upstream = await undiciFetch(parsed.toString(), {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' || !body ? undefined : new Uint8Array(body),
        signal: ac.signal,
        dispatcher: arkAgent,
      });
      if (!upstream.ok) {
        res.statusCode = upstream.status;
        // 把上游的错误体透传回去，前端才能看清是欠费还是参数错
        const text = await upstream.text().catch(() => '');
        res.setHeader('Content-Type', 'application/json');
        res.end(text || `upstream ${upstream.status}`);
        return;
      }
      const len = upstream.headers.get('content-length');
      if (len && Number(len) > MAX_BYTES) {
        res.statusCode = 413;
        res.end('too large');
        return;
      }
      const buf = new Uint8Array(await upstream.arrayBuffer());
      res.statusCode = 200;
      res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/octet-stream');
      res.setHeader('Content-Length', String(buf.byteLength));
      res.setHeader('Cache-Control', 'no-store');
      res.end(buf);
    } catch (err) {
      res.statusCode = 502;
      res.end(`proxy failed: ${(err as Error).message}`);
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

export default defineConfig(({ command }) => {
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
    plugins: [react(), tailwindcss(), arkProxy(), dropOrtJsepWasm()],
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
