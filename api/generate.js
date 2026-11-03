/**
 * 豆包图生图（Seedream）转发：POST /generate
 * 同步生成约 20–30 秒，需要 maxDuration 提到 60s。
 */
import { forward } from './_forward.js';

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const body = req.body ? JSON.stringify(req.body) : '{}';
  await forward(req, res, 'https://ark.cn-beijing.volces.com/api/v3/images/generations', body);
}
