/**
 * Vercel Serverless Function 共享转发逻辑（_ 前缀文件不会被当作函数）。
 *
 * 火山方舟所有接口都没有 CORS 头，浏览器无法直连；Vercel 上由这些函数
 * 服务端转发，再经 rewrites 把 /generate 等前端路径映射过来（见 vercel.json）。
 * 只放行火山方舟相关域名，防 SSRF。
 */

import https from 'https';

const ALLOWED_HOSTS = [
  /(^|\.)tos-cn-beijing\.volces\.com$/i,
  /^ark\.cn-beijing\.volces\.com$/i,
];

/**
 * 豆包 Key 只在服务端（Vercel 环境变量 DOUBAO_API_KEY）。
 * 不要用 VITE_ 前缀，那样会被打进前端 bundle 公开。
 */
const SERVER_KEY = (process.env.DOUBAO_API_KEY || process.env.VITE_DOUBAO_API_KEY || '').trim();

/**
 * 把请求转发到火山方舟。
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} target 目标 URL（已含白名单校验）
 * @param {string|null} body 请求体字符串；null 表示无 body（GET）
 */
export function forward(req, res, target, body) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      res.status(400).send('bad url');
      return resolve();
    }
    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.some((re) => re.test(parsed.hostname))) {
      res.status(403).send('host not allowed');
      return resolve();
    }

    // 转发请求头（去掉 hop-by-hop 头）
    const fwd = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v || ['host', 'connection', 'content-length', 'transfer-encoding'].includes(k.toLowerCase())) continue;
      fwd[k] = v;
    }

    // 服务端配了 Key 就一律用它，忽略前端传来的
    if (SERVER_KEY && /^ark\.cn-beijing\.volces\.com$/i.test(parsed.hostname)) {
      fwd.authorization = `Bearer ${SERVER_KEY}`;
    }

    const upstream = https.request(
      parsed,
      { method: req.method, headers: fwd, timeout: 300000 },
      (upRes) => {
        res.status(upRes.statusCode || 502);
        res.setHeader('Content-Type', upRes.headers['content-type'] || 'application/octet-stream');
        upRes.pipe(res);
      }
    );
    upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
    upstream.on('error', (e) => {
      if (!res.headersSent) res.status(502);
      res.end('upstream error: ' + (e && e.message ? e.message : String(e)));
      resolve();
    });
    upstream.on('close', resolve);
    if (body) upstream.write(body);
    upstream.end();
  });
}
