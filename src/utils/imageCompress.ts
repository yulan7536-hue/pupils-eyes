/**
 * 图片压缩。
 *
 * 作品图和贴纸都直接存在数据库里（云存储不支持公开读，发不了长期链接），
 * 所以体积必须压到「一行装得下」：列表只拉缩略图，详情再按 id 取原图。
 * 走 WebP；浏览器不支持时 toDataURL 会悄悄退回 PNG，体积翻几倍，那就改用 JPEG。
 */

export interface CompressOptions {
  /** 最长边像素 */
  maxSide: number;
  /** 目标上限（dataURL 字符数，约等于字节数） */
  maxChars: number;
  quality?: number;
}

const LADDER = [1, 0.82, 0.68];

export async function compressImage(
  file: File,
  { maxSide, maxChars, quality = 0.72 }: CompressOptions
): Promise<{ dataUrl: string; bytes: number }> {
  const bitmap = await createImageBitmap(file);
  let last = '';

  try {
    for (const shrink of LADDER) {
      const side = Math.round(maxSide * shrink);
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('这个浏览器不支持图片压缩');
      ctx.drawImage(bitmap, 0, 0, w, h);

      let out = canvas.toDataURL('image/webp', quality);
      if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', quality);
      last = out;

      if (out.length <= maxChars) break;
    }
  } finally {
    bitmap.close?.();
  }

  return { dataUrl: last, bytes: last.length };
}

/** 作品原图：900px 够看清，压到 24 万字符以内 */
export const compressWorkImage = (file: File) =>
  compressImage(file, { maxSide: 900, maxChars: 240_000, quality: 0.72 });

/** 列表缩略图：360px，卡片与相册封面用 */
export const compressThumb = (file: File) =>
  compressImage(file, { maxSide: 360, maxChars: 60_000, quality: 0.66 });

/** 贴纸：带透明通道，用 PNG 保留 alpha，尺寸收到 512 */
export async function compressSticker(file: File): Promise<{ dataUrl: string; bytes: number; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = 512;
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('这个浏览器不支持图片压缩');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const out = canvas.toDataURL('image/png');
    return { dataUrl: out, bytes: out.length, width: w, height: h };
  } finally {
    bitmap.close?.();
  }
}
