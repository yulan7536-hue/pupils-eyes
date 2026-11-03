/**
 * 服务端能力探测：GET /ai-status
 * 前端据此决定要不要走 AI 重绘（线上 Key 只在服务端，前端看不到）。
 */
const configured = Boolean(
  (process.env.DOUBAO_API_KEY || process.env.VITE_DOUBAO_API_KEY || '').trim()
);

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ configured });
}
