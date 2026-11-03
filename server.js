/**
 * 线上服务入口：同一个 Node 进程同时提供前端静态文件 + 豆包转发 API。
 *
 * 为什么前后端合一：
 * - 火山方舟所有接口（图生图 / Seed3D / TOS 下载）都没有 CORS 头，浏览器无法直连。
 * - 之前把转发挂在 vite preview 中间件（/ark-proxy）上，线上部署平台的网关会拦截它
 *   （返回 `Unsupported zti authentication method`），导致豆包通道全部失效。
 * - 改成 express 自己 serve dist + 转发，前后端同源，前端 fetch('/generate') 等
 *   就是同源请求，不涉及 CORS，也不依赖 vite 的中间件。
 *
 * 本地开发（npm run dev）走 vite.config.ts 里的同名中间件，路径保持一致。
 */

import express from 'express';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

const ARK_BASE = 'https://ark.cn-beijing.volces.com';
const ALLOWED_HOSTS = [
  /(^|\.)tos-cn-beijing\.volces\.com$/i,
  /^ark\.cn-beijing\.volces\.com$/i,
];

/** 校验并转发一个请求到火山方舟（只放行白名单域名，防 SSRF） */
function proxyTo(req, res, target) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).send('bad url');
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.some((re) => re.test(parsed.hostname))) {
    return res.status(403).send('host not allowed');
  }

  const fwd = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!v || ['host', 'connection', 'content-length', 'transfer-encoding'].includes(k.toLowerCase())) continue;
    fwd[k] = v;
  }

  const upstream = https.request(
    parsed,
    { method: req.method, headers: fwd, timeout: 300000 },
    (upRes) => {
      res.status(upRes.statusCode || 502);
      res.set('Content-Type', upRes.headers['content-type'] || 'application/octet-stream');
      upRes.pipe(res);
    }
  );
  upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
  upstream.on('error', (e) => {
    if (!res.headersSent) res.status(502);
    res.end('upstream error: ' + (e && e.message ? e.message : String(e)));
  });
  req.pipe(upstream);
}

/* ---------------- 豆包转发 API ---------------- */

// 图生图（Seedream）
app.post('/generate', (req, res) => proxyTo(req, res, `${ARK_BASE}/api/v3/images/generations`));
// Seed3D：创建任务
app.post('/task', (req, res) => proxyTo(req, res, `${ARK_BASE}/api/v3/contents/generations/tasks`));
// Seed3D：查询任务
app.get('/task', (req, res) =>
  proxyTo(req, res, `${ARK_BASE}/api/v3/contents/generations/tasks/${encodeURIComponent(String(req.query.id || ''))}`)
);
// TOS 模型下载
app.get('/download', (req, res) => proxyTo(req, res, String(req.query.url || '')));

/* ---------------- 前端静态文件 + SPA fallback ---------------- */

const dist = path.join(__dirname, 'dist');
app.use(express.static(dist));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[pupils-eyes] listening on 0.0.0.0:${PORT}`);
});
