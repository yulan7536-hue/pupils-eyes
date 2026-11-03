/**
 * 豆包 Seed3D 任务转发：
 *   POST /task        创建任务
 *   GET  /task?id=xxx 查询任务
 */
import { forward } from './_forward.js';

const BASE = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';

export default async function handler(req, res) {
  const id = req.query.id ? String(req.query.id) : '';
  const target = id ? `${BASE}/${encodeURIComponent(id)}` : BASE;
  const body = req.method === 'POST' && req.body ? JSON.stringify(req.body) : null;
  await forward(req, res, target, body);
}
