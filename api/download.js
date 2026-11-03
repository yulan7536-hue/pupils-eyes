/**
 * 火山 TOS 模型下载转发：GET /download?url=<encoded>
 * 模型 zip 约 14MB，给足 maxDuration。
 */
import { forward } from './_forward.js';

export const maxDuration = 60;

export default async function handler(req, res) {
  const url = req.query.url ? String(req.query.url) : '';
  await forward(req, res, url, null);
}
