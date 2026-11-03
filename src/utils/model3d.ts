/**
 * 图生 3D：照片 → glb 模型（豆包 Seed3D 2.0）。
 *
 * 链路（官方异步任务接口，全部走同源 /task、/download，见 vite.config.ts 与 server.js）：
 *   1. POST /task 创建任务（图片走 base64 data URL）
 *   2. 每 5s GET /task?id={id} 轮询，succeeded 后拿 content.file_url
 *   3. 下载的是 zip（内部结构 pbr/mesh_textured_pbr.glb），用 fflate 解压取出 glb
 *
 * 为什么走代理：方舟接口没有 CORS 头，浏览器直连必 Failed to fetch。
 *
 * 几个实测/文档确认的坑：
 *  - 文本部分不是提示词，只能传参数（`--subdivisionlevel low --fileformat glb`）
 *  - 生成要 3–10 分钟，任务 ID 存 localStorage，刷新/退出后能接着查
 *  - file_url 24 小时过期，成功要立刻下载
 *  - 面数档位 low=10万 / medium=50万 / high=100万，网页端展示用 low 足够
 */

import { unzipSync } from 'fflate';
import { getDoubaoKey } from './stickerAI';

const SEED3D_MODEL = 'doubao-seed3d-2-0-260328';
/** 轮询间隔（文档建议别太猛，3D 生成本身要几分钟） */
const POLL_INTERVAL = 5000;
/** 最长等待 20 分钟 */
const MAX_WAIT_MS = 20 * 60 * 1000;
/** 待处理任务的本地记录键（支持退出后继续） */
const PENDING_KEY = 'pupils-eyes:model3d-task';

export interface PendingModelTask {
  id: string;
  startedAt: number;
}

export interface Model3DResult {
  /** 解压出来的 glb 模型 */
  glb: Blob;
  /** 体积（字节），用于提示 */
  bytes: number;
}

/** 记住正在生成的任务，页面刷新后还能接着查 */
export function savePendingTask(task: PendingModelTask) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(task));
  } catch {
    /* ignore */
  }
}

export function loadPendingTask(): PendingModelTask | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as PendingModelTask;
    // 超过 30 分钟的任务视为失效（file_url 也只活 24 小时）
    if (!t?.id || Date.now() - (t.startedAt || 0) > 30 * 60 * 1000) return null;
    return t;
  } catch {
    return null;
  }
}

export function clearPendingTask() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------------- 图像工具 ---------------- */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 压缩到指定长边并转 base64 data URL（文档要求 < 4096×4096，这里留足余量） */
async function toDataUrl(file: File, maxEdge = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    return new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(file);
    });
  }
  const k = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * k));
  const h = Math.max(1, Math.round(bitmap.height * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  // 3D 生成不接受透明背景，先铺白
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return c.toDataURL('image/jpeg', 0.9);
}

/* ---------------- 任务接口 ---------------- */

async function createTask(dataUrl: string, key: string): Promise<string> {
  // 方舟接口没有 CORS 头，直连必 Failed to fetch，走同源 /task（dev 中间件 / 线上 server.js）
  const res = await fetch('/task', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: SEED3D_MODEL,
      content: [
        // 文本位只放参数，不能写提示词
        { type: 'text', text: ' --subdivisionlevel low --fileformat glb' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    }),
  });

  const txt = await res.text().catch(() => '');
  if (!res.ok) {
    let code = '';
    try {
      code = JSON.parse(txt)?.error?.code || '';
    } catch {
      /* ignore */
    }
    throw new Error(`seed3d create ${res.status}${code ? ' ' + code : ''}: ${txt.slice(0, 200)}`);
  }
  let json: { id?: string } = {};
  try {
    json = JSON.parse(txt);
  } catch {
    /* ignore */
  }
  if (!json?.id) throw new Error('seed3d 未返回任务 ID');
  return json.id;
}

interface TaskStatus {
  status: string;
  fileUrl?: string;
  errMsg?: string;
}

async function queryTask(id: string, key: string): Promise<TaskStatus> {
  const res = await fetch(`/task?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const txt = await res.text().catch(() => '');
  let j: Record<string, unknown> = {};
  try {
    j = JSON.parse(txt);
  } catch {
    /* ignore */
  }
  const content = (j as { content?: { file_url?: string } }).content;
  const err = (j as { error?: { message?: string } }).error;
  return {
    status: String((j as { status?: string }).status || (res.ok ? 'unknown' : 'failed')),
    fileUrl: content?.file_url,
    errMsg: err?.message || (res.ok ? undefined : txt.slice(0, 200)),
  };
}

/**
 * 下载字节流。
 * 优先走同源代理 /download?url=<encoded>（dev 中间件 / 线上 server.js）：
 * 模型 zip 在火山 TOS 桶上，桶没配 CORS 头，浏览器直连会被拦成 `Failed to fetch`
 * （Chrome 报 MissingAllowOriginHeader），这是线上「3D 上传失败」的真正原因。
 * 代理不可用（例如纯静态托管）时退回直连，并给出可读的失败原因。
 */
async function downloadBytes(url: string): Promise<ArrayBuffer> {
  let note = '';
  try {
    const viaProxy = await fetch(`/download?url=${encodeURIComponent(url)}`);
    if (viaProxy.ok) return await viaProxy.arrayBuffer();
    note = `（代理返回 ${viaProxy.status}）`;
  } catch {
    note = '（代理不可用）';
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载模型失败 ${res.status}`);
    return await res.arrayBuffer();
  } catch (err) {
    // 直连失败几乎都是跨域：TOS 桶没有 Access-Control-Allow-Origin
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new Error(`CORS 拦截：模型文件所在存储不允许跨域读取${note}`);
    }
    throw err;
  }
}

/** 下载 zip → 解压 → 取出里面最大的 .glb */
async function extractGlbFromZip(url: string): Promise<Blob> {
  const buf = new Uint8Array(await downloadBytes(url));

  // 万一直接就是 glb（不以 zip 结构返回的情况）
  if (buf[0] === 0x67 && buf[1] === 0x6c && buf[2] === 0x54) {
    return new Blob([buf], { type: 'model/gltf-binary' });
  }

  const files = unzipSync(buf);
  let best: { name: string; data: Uint8Array } | null = null;
  for (const [name, data] of Object.entries(files)) {
    if (!/\.glb$/i.test(name)) continue;
    if (!best || data.length > best.data.length) best = { name, data };
  }
  if (!best) throw new Error('压缩包里没有 .glb 文件');
  // 复制一份成 Uint8Array<ArrayBuffer>，满足 BlobPart 的类型约束
  return new Blob([new Uint8Array(best.data)], { type: 'model/gltf-binary' });
}

/* ---------------- 主流程 ---------------- */

/**
 * 创建 3D 生成任务，返回任务 ID。
 * 拆成两步是为了支持「创建后就关页面，回头再取」，不用一直挂着轮询。
 */
export async function startModel3D(file: File): Promise<string> {
  const key = getDoubaoKey();
  if (!key) throw new Error('未配置豆包 API Key');
  const dataUrl = await toDataUrl(file, 1024);
  const id = await createTask(dataUrl, key);
  savePendingTask({ id, startedAt: Date.now() });
  return id;
}

/** 等待任务完成并取回 glb */
export async function waitModel3D(
  id: string,
  onProgress?: (pct: number, stage: string) => void
): Promise<Model3DResult> {
  const key = getDoubaoKey();
  if (!key) throw new Error('未配置豆包 API Key');

  const started = Date.now();
  // 进度：3D 生成本身不可观测，用时间估算（前 90% 给生成，后 10% 给下载解压）
  while (Date.now() - started < MAX_WAIT_MS) {
    const st = await queryTask(id, key);
    if (st.status === 'succeeded' && st.fileUrl) {
      onProgress?.(90, '模型生成好了，正在下载');
      const glb = await extractGlbFromZip(st.fileUrl);
      onProgress?.(100, '完成');
      clearPendingTask();
      return { glb, bytes: glb.size };
    }
    if (st.status === 'failed') {
      clearPendingTask();
      throw new Error(st.errMsg || '3D 生成失败');
    }
    const elapsed = Date.now() - started;
    // 估算：前 4 分钟涨到 70%，之后缓慢爬到 88%
    const est = Math.min(88, Math.round((elapsed / 240000) * 70));
    onProgress?.(Math.max(5, est), st.status === 'queued' ? '排队中' : '正在生成 3D 模型');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error('3D 生成超时（超过 20 分钟）');
}

/** 一步到位：上传 → 等结果 */
export async function generate3D(
  file: File,
  onProgress?: (pct: number, stage: string) => void
): Promise<Model3DResult> {
  onProgress?.(2, '正在上传照片');
  const id = await startModel3D(file);
  return waitModel3D(id, onProgress);
}
