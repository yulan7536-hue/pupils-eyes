import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import type {IncomingMessage, ServerResponse} from 'node:http';

/**
 * 豆包 Seed3D 生成完成后，模型 zip 放在火山 TOS 桶上，桶没有配 CORS 头，
 * 浏览器直连会报 `MissingAllowOriginHeader`（Failed to fetch），
 * 于是「照片变 3D 摆件」在生成 3-5 分钟后才失败。
 *
 * 这里挂一个同源代理把它绕过去：/ark-proxy?url=<encoded>
 * - dev（configureServer）与 preview（configurePreviewServer）都生效，
 *   线上部署跑的正是 `vite preview`，所以不用额外起后端服务。
 * - 只放行火山方舟相关域名，避免变成任意 URL 的开放代理（SSRF）。
 * - 路径特意不用 /api 前缀：部署平台的网关会抢占 /api/*，任何请求都返回
 *   `Unsupported zti authentication method`，根本到不了这个中间件。
 */
const PROXY_PATH = '/ark-proxy';
/** 生图接口地址固定，直接写死，不走 url 参数（见下） */
const ARK_GENERATE_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const ALLOWED_HOSTS = [
  /(^|\.)tos-cn-beijing\.volces\.com$/i,
  /^ark\.cn-beijing\.volces\.com$/i,
];
/** 模型 zip 约 16MB，留足余量但不无限 */
const MAX_BYTES = 120 * 1024 * 1024;

function arkProxy(): Plugin {
  const handler = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void
  ) => {
    if (!req.url?.startsWith(PROXY_PATH)) return next();

    const reqUrl = new URL(req.url, 'http://localhost');
    let target = reqUrl.searchParams.get('url') ?? '';
    // 生图 endpoint 固定，用路径 /ark-proxy/generate 表达，不带 url 参数。
    // 线上部署平台的网关会拦截「query 里带外部 https URL」的代理请求
    // （返回 `Unsupported zti authentication method`），导致豆包图生图在线上
    // 永远到不了这里、只能 fallback 到 Gemini。把目标从 query 挪到路径即可绕过。
    if (reqUrl.pathname === `${PROXY_PATH}/generate`) {
      target = ARK_GENERATE_ENDPOINT;
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

      const upstream = await fetch(parsed.toString(), {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' || !body ? undefined : new Uint8Array(body),
        signal: ac.signal,
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
