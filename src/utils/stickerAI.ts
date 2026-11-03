/**
 * 照片 → 拼贴花园贴纸。
 *
 * 全链路都在浏览器本机完成，不联网、不花钱、不需要填任何 Key：
 *   1. 压缩         把长边压到 1024，控制后续计算量
 *   2. AI 抠图      ISNet 语义分割，自动认出"画面里最主要的那个东西"（见 rembg.ts）
 *   3. 换画风       钢笔淡彩管线，抹掉照片细节、压成粉彩、补墨线与纸纹（见 watercolor.ts）
 *   4. 收尾         裁掉透明边 → 缩到 512 → 存 webp，一张 100–200KB
 *
 * 拆成 prepare / paint 两段，是因为用户要在预览里来回调风格参数：
 * 抠图只做一次（慢），换风格只是本地重算（快），调参数不会重复下载模型。
 *
 * 说明：这里保留了豆包 Key 的读写函数。3D 摆件（model3d.ts）仍然走豆包 Seed3D，
 * 那是单独的免费额度，与本文件的贴纸链路无关。
 */

import { aiCutout } from './rembg';
import { watercolorize, type WatercolorOptions } from './watercolor';
import { aiRestyle, hasServerAi } from './aiRestyle';

const DOUBAO_KEY_LOCAL = 'pupils-eyes:doubao-key';

/* ---------------- 豆包 Key（3D 摆件复用） ---------------- */

/** 读取豆包 Key：页面内 localStorage 优先，其次构建期环境变量 */
export function getDoubaoKey(): string {
  if (typeof window !== 'undefined') {
    try {
      const local = window.localStorage.getItem(DOUBAO_KEY_LOCAL);
      if (local) return local.trim();
    } catch {
      /* ignore */
    }
  }
  const env = (import.meta.env as unknown as Record<string, string | undefined>).VITE_DOUBAO_API_KEY;
  return env ?? '';
}

export function setDoubaoKey(key: string) {
  if (typeof window === 'undefined') return;
  try {
    if (key.trim()) window.localStorage.setItem(DOUBAO_KEY_LOCAL, key.trim());
    else window.localStorage.removeItem(DOUBAO_KEY_LOCAL);
  } catch {
    /* ignore */
  }
}

export function hasDoubaoKey(): boolean {
  return Boolean(getDoubaoKey());
}

/* ---------------- 图像工具 ---------------- */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error('读取文件失败'));
    fr.readAsDataURL(blob);
  });
}

/** dataURL → Blob（AI 返回的图要再过一次抠图，抠图接口只吃 Blob） */
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const head = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const body = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** 压缩到长边 maxLen 的 JPEG，同时返回原始像素尺寸 */
async function compress(file: File, maxLen: number): Promise<{ blob: Blob; dataUrl: string }> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    return { blob: file, dataUrl: await blobToDataUrl(file) };
  }

  const scale = Math.min(1, maxLen / Math.max(bitmap.width, bitmap.height));
  const cw = Math.max(1, Math.round(bitmap.width * scale));
  const ch = Math.max(1, Math.round(bitmap.height * scale));

  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(bitmap, 0, 0, cw, ch);
  bitmap.close?.();

  const dataUrl = c.toDataURL('image/jpeg', 0.86);
  const blob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.86));
  return { blob, dataUrl };
}

/**
 * 贴纸收尾：裁掉四周全透明的边（保留 2% 内边距）+ 降采样到最长边 512 + 输出 webp。
 * - 裁边：主体外常有一圈空白，裁掉后 Sprite 里才显得饱满。
 * - 降采样 + webp：512 webp 约 100–200KB，比原图小一个数量级，localStorage 放得下。
 */
async function finalizeSticker(pngDataUrl: string): Promise<string> {
  const img = await loadImage(pngDataUrl);
  const w = img.width;
  const h = img.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    minX = 0;
    minY = 0;
    maxX = w - 1;
    maxY = h - 1;
  } else {
    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02);
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
  }

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const MAX_EDGE = 512;
  const k = Math.min(1, MAX_EDGE / Math.max(cw, ch));
  const ow = Math.max(1, Math.round(cw * k));
  const oh = Math.max(1, Math.round(ch * k));

  const out = document.createElement('canvas');
  out.width = ow;
  out.height = oh;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(c, minX, minY, cw, ch, 0, 0, ow, oh);

  const webp = out.toDataURL('image/webp', 0.92);
  return webp.startsWith('data:image/webp') ? webp : out.toDataURL('image/png');
}

/* ---------------- 对外接口 ---------------- */

export interface PreparedPhoto {
  /** 抠好图、背景透明（dataURL，PNG） */
  cutout: string;
  /** 抠图前的原图（dataURL，已压缩），「原色」模式直接用 */
  source: string;
  /** AI 重绘并抠好的插画贴纸（失败时为 undefined） */
  aiImage?: string;
  /** AI 失败原因，用于给用户一句提示 */
  aiNote?: string;
}

export type StickerStyle = 'watercolor' | 'original';

export interface StickerStyleOptions {
  style?: StickerStyle;
  /**
   * 不抠主体，整张照片做成圆角贴纸。
   *
   * AI 分割找的是"画面里最显著的那一个东西"。拍一堆积木、一片花田、
   * 一张画满的画时，它只会留下其中一小块，用户会觉得"怎么把我拍的全删了"。
   * 这种照片更适合整张裁成圆角贴纸 —— 和手工贴纸本里的照片贴一个道理。
   */
  whole?: boolean;
  /** 水彩浓度 0–1（越大越淡） */
  wash?: number;
  /** 墨线 0–1 */
  ink?: number;
}

/**
 * 整张贴纸：把方图裁成圆角，并描一圈白边。
 * 白边是"贴纸感"的关键 —— 有它才像从贴纸板上撕下来的一张。
 */
async function roundRectSticker(img: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const w = img.width;
  const h = img.height;
  const border = Math.round(Math.min(w, h) * 0.055);
  const cw = w + border * 2;
  const ch = h + border * 2;

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const ctx = out.getContext('2d')!;

  const radius = Math.round(Math.min(w, h) * 0.12) + border;

  const path = (x: number, y: number, ww: number, hh: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + ww - r, y);
    ctx.quadraticCurveTo(x + ww, y, x + ww, y + r);
    ctx.lineTo(x + ww, y + hh - r);
    ctx.quadraticCurveTo(x + ww, y + hh, x + ww - r, y + hh);
    ctx.lineTo(x + r, y + hh);
    ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // 白底 + 极浅的投影边，贴到花园里不会糊在背景上
  ctx.fillStyle = '#ffffff';
  path(0, 0, cw, ch, radius);
  ctx.fill();

  ctx.save();
  path(border, border, w, h, Math.max(2, radius - border));
  ctx.clip();
  ctx.drawImage(img, border, border);
  ctx.restore();

  return out;
}

/**
 * 第一步：抠图 + AI 重绘。
 *
 * 抠图慢（首次还要下模型），只做一次；AI 重绘也放在这一步，
 * 这样预览面板里换风格仍然是本地重算，不用担心每次拖滑块都花钱。
 */
export async function prepareSticker(
  file: File,
  onProgress?: (pct: number, stage: string) => void
): Promise<PreparedPhoto> {
  const report = (pct: number, stage: string) => onProgress?.(pct, stage);

  report(4, '读取照片');
  const { blob, dataUrl } = await compress(file, 1024);

  report(10, '正在识别画面主体');
  const cutBlob = await aiCutout(blob, ({ pct, label }) => {
    // 抠图占 10–65，后面要留给 AI 重绘
    report(10 + pct * 55, label);
  });
  const cutout = await blobToDataUrl(cutBlob);

  /**
   * AI 重绘：模型真正"画"一遍，才有插画的分色线和色块。
   * 失败（没 Key / 欠费 / 网络）不影响主流程，回落本地引擎。
   */
  let aiImage: string | undefined;
  let aiNote = '';

  if (hasDoubaoKey() || (await hasServerAi())) {
    report(68, 'AI 正在画一版插画（约 20 秒）');
    try {
      const { dataUrl: painted } = await aiRestyle(dataUrl);
      // AI 会给主体补上背景，再抠一次才是干净贴纸
      report(88, '正在分离画好的主体');
      const aiBlob = await aiCutout(dataUrlToBlob(painted));
      aiImage = await blobToDataUrl(aiBlob);
    } catch (err) {
      aiNote = (err as Error).message || 'AI 重绘失败';
    }
  }

  report(100, aiImage ? '插画版做好了' : '主体已分离');
  return { cutout, source: dataUrl, aiImage, aiNote };
}

/**
 * 第二步：出图。
 * 读抠好的图 → 上画风 → 裁边压缩。纯本地，通常 100–300ms。
 *
 * - watercolor：钢笔淡彩（默认）
 * - original：保留照片原色，只抠图
 */
export async function paintSticker(
  prepared: PreparedPhoto,
  opts: StickerStyleOptions = {}
): Promise<string> {
  const styleOpts: WatercolorOptions = {
    wash: opts.wash ?? 0.55,
    ink: opts.ink ?? 0.5,
  };

  // 整张照片做贴纸：不走抠图，直接上画风再裁圆角
  if (opts.whole) {
    const src = await loadImage(prepared.source);
    const painted = await watercolorize(src, styleOpts);
    const rounded = await roundRectSticker(painted);
    return finalizeSticker(rounded.toDataURL('image/png'));
  }

  // 抠主体 + 淡彩：有 AI 画好的版本就用它（真正的手绘插画感），没有才走本地滤镜
  if (opts.style !== 'original' && prepared.aiImage) {
    return finalizeSticker(prepared.aiImage);
  }

  const cut = await loadImage(prepared.cutout);

  if (opts.style === 'original') {
    return finalizeSticker(prepared.cutout);
  }

  const painted = await watercolorize(cut, styleOpts);
  return finalizeSticker(painted.toDataURL('image/png'));
}

/**
 * 把任意一张（AI 重绘得到的）图收尾成贴纸：裁透明边 → 缩 512 → webp。
 * 给 AI 通道用，本地通道内部直接调 finalizeSticker。
 */
export async function finalizeExternal(dataUrl: string): Promise<string> {
  return finalizeSticker(dataUrl);
}

/** 预览里没确认就关掉时，把中间产物释放掉，避免内存里堆一堆 dataURL */
export function disposePrepared(prepared: PreparedPhoto | null): void {
  if (!prepared) return;
  prepared.cutout = '';
  prepared.source = '';
}
