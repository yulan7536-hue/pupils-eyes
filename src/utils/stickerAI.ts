/**
 * 贴纸 AI：照片 → 钢笔淡彩风贴纸。
 *
 * 链路：客户端压缩 → 豆包（火山方舟）图生图做「钢笔淡彩风」迁移 → 前端 Canvas 去白底。
 * 豆包不可用 / 无 Key / 调用失败时，降级为前端滤镜模拟淡彩（不真抠图）。
 *
 * 豆包走 OpenAI 兼容的 images/generations 端点，Key 优先读页面内 localStorage，
 * 其次读构建期环境变量 VITE_DOUBAO_API_KEY（见 .env.local）。
 */

const DOUBAO_KEY_LOCAL = 'pupils-eyes:doubao-key';
const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
/**
 * 图生图模型：Doubao Seedream 5.0 Flash（用户账号已开通，实测 200 可用）。
 * 其它备选 Model ID：doubao-seedream-5-0-pro-260628 / doubao-seedream-5-0-lite-260128
 * 若模型失效，到方舟「模型列表」换一个即可。
 */
const DOUBAO_I2I_MODEL = 'doubao-seedream-5-0-flash-260915';

/**
 * 图生图 prompt。
 * 写法刻意采用「先观察 → 再只画主体」的指令式结构：Seedream 对这类
 * 分步指令的理解明显优于一句话描述，能自动判断画面主体并丢掉背景。
 */
const PEN_INK_PROMPT =
  '第一步：仔细观察这张图，判断画面里最主要的那一个主体是什么' +
  '（可能是一个人、一只动物、一件物品、一栋建筑、一朵花或一份手工作品）。' +
  '第二步：只把这个主体重绘成钢笔淡彩风贴纸，完整保留它的外形轮廓、颜色和辨识度，不要改成一个别的物体。' +
  '只画这一个主体，原图的背景、环境、地面、街道、其他物体一律不要画进来，也不要把整幅场景画进画面。' +
  '画法：纤细的深棕色墨水线条勾勒轮廓与细节，水彩淡色轻薄晕染填色，' +
  '低饱和马卡龙粉彩配色，保留纸面质感与自然留白。' +
  '主体完整、居中、占画面约 75%，四周留白。' +
  '背景为纯净的白色（#FFFFFF），不要阴影、不要投影、不要地面。' +
  '无文字、无水印、无边框。';

export interface StylizeResult {
  /** 贴纸 dataURL（webp，透明背景） */
  dataUrl: string;
  /** 是否真的走了豆包 AI（false = 前端降级） */
  usedAI: boolean;
  /** 降级原因（usedAI=false 时有值），用于给用户可见提示 */
  failReason?: string;
}

function getDoubaoKey(): string {
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

/** 页面内保存 / 清除豆包 Key */
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
    img.onerror = reject;
    img.src = src;
  });
}

/** 客户端压缩：长边压到 maxLen，输出 JPEG dataURL */
async function compressImage(file: File, maxLen = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  const dataUrl = await new Promise<string>((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(file);
  });
  if (!bitmap) return dataUrl;

  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, maxLen / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(bitmap, 0, 0, cw, ch);
  bitmap.close?.();
  return c.toDataURL('image/jpeg', 0.85);
}

/** base64 → dataURL；URL 原样返回 */
function b64ToDataUrl(raw: string, format = 'png'): string {
  if (raw.startsWith('data:')) return raw;
  if (raw.startsWith('http')) return raw;
  return `data:image/${format};base64,${raw}`;
}

/**
 * 去白底（贴纸化）：把背景变透明，同时保护主体上的浅色细节（花瓣、白云等）。
 *
 * 策略 = 「边缘 flood fill」∪「全图纯白」：
 *  - flood fill 从四边向内扩散，吃掉与画面边缘连通的白底 / 浅灰底（阈值放宽到 218），
 *    这样水彩浅色渐变能被清干净；
 *  - 纯白（≥ 248）无论在哪都吃掉，处理主体内部镂空（如梁柱之间的透空）。
 *  - 两层都不命中的浅色像素（花瓣、奶白衣物）会被保留 —— 旧版「全图阈值」
 *    会把这些误删成半透明幽灵。
 *
 * 豆包用 output_format:'png' 输出，没有 JPEG 压缩噪点，所以不需要额外形态学清理。
 */
async function cutoutWhite(imageSrc: string): Promise<string> {
  const img = await loadImage(imageSrc);
  const w = img.width;
  const h = img.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  /** 亮度（取最大通道，白色系判断更稳） */
  const luma = (i: number) => Math.max(px[i], px[i + 1], px[i + 2]);

  const FLOOD_THRESH = 226; // 与边缘连通的白底（含浅灰水彩晕染）
  const PURE_THRESH = 246; // 任意位置的纯白

  // —— 1) 从四边 flood fill ——
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    if (luma(p * 4) < FLOOD_THRESH) return;
    visited[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  // —— 2) 置透明：flood 命中 ∪ 纯白 ——
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const L = luma(i);
    let alpha = px[i + 3];
    if (visited[p]) {
      alpha = 0;
    } else if (L >= PURE_THRESH) {
      // 纯白：越白越透明，246→1 平滑过渡到 255→0
      alpha = Math.round(alpha * (1 - Math.min(1, (L - PURE_THRESH) / 9)));
    }
    px[i + 3] = alpha;
  }

  ctx.putImageData(data, 0, 0);
  return c.toDataURL('image/png');
}

/**
 * 贴纸收尾：裁掉四周全透明的边（保留 2% 内边距）+ 降采样到最长边 512 + 输出 webp。
 * - 裁边：AI 输出常带大块白边，裁掉后主体才能填满 Sprite，显得饱满清晰。
 * - 降采样 + webp：1K PNG 约 1.3–1.9MB，几张就撑爆 localStorage 配额；
 *   Sprite 在屏幕上只有一两百像素，512 webp 约 100–200KB 完全够用。
 * 无透明像素时（降级滤镜路径）只做降采样压缩。
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
    // 整张全透明（异常情况）：用整图，仍走降采样压缩
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

/** 前端降级：去饱和 + 提亮 + 轻微描边，模拟钢笔淡彩（不抠图） */
async function fallbackStylize(imageSrc: string): Promise<string> {
  const img = await loadImage(imageSrc);
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  // 提亮 + 轻微降低饱和度，向淡彩靠
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = 'rgba(128,128,128,0.55)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-over';
  return c.toDataURL('image/png');
}

/** 把接口错误翻译成给用户看的一句话 */
function describeFailure(msg: string): string {
  if (msg.includes('AccountOverdue')) return 'AI 账户欠费，已用本地淡彩替代';
  if (msg.includes('401') || msg.includes('Unauthorized')) return 'AI Key 无效，已用本地淡彩替代';
  if (msg.includes('429')) return 'AI 调用太频繁，已用本地淡彩替代';
  if (msg.includes('InvalidParameter')) return 'AI 参数异常，已用本地淡彩替代';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return '网络不通，已用本地淡彩替代';
  return 'AI 暂时不可用，已用本地淡彩替代';
}

/* ---------------- 主流程 ---------------- */

export async function stylizeImage(
  file: File,
  onProgress?: (pct: number, stage: string) => void
): Promise<StylizeResult> {
  const report = (pct: number, stage: string) => onProgress?.(pct, stage);

  report(5, '读取图片');
  const compressed = await compressImage(file, 1024);
  report(30, '压缩完成');

  const key = getDoubaoKey();
  let failReason = '';

  if (key) {
    report(40, '正在用 AI 生成淡彩风格');
    try {
      const res = await fetch(ARK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: DOUBAO_I2I_MODEL,
          prompt: PEN_INK_PROMPT,
          // 图生图：image 传完整 data URL（含 data:image/jpeg;base64, 前缀）
          image: [compressed],
          size: '1K',
          // PNG 输出：无 JPEG 压缩噪点，抠图后边缘干净
          output_format: 'png',
          // 注意：5.0 Flash 不支持 sequential_image_generation，传了会 400 InvalidParameter
          watermark: false,
          response_format: 'b64_json',
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`doubao ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = await res.json();
      const first = json?.data?.[0];
      const b64 = first?.b64_json || first?.url;
      if (!b64) throw new Error('doubao 未返回图像');
      const fmt = (first?.output_format as string) || 'png';

      report(85, '正在去掉白底');
      const cut = await cutoutWhite(b64ToDataUrl(b64, fmt));
      report(94, '正在裁边压缩');
      const dataUrl = await finalizeSticker(cut);
      report(100, '完成');
      return { dataUrl, usedAI: true };
    } catch (err) {
      console.warn('[stickerAI] 豆包调用失败，降级为前端滤镜', err);
      failReason = describeFailure(String((err as Error)?.message ?? err));
    }
  }

  // 降级：前端滤镜 + 同样的降采样压缩（否则 1.9MB PNG 会撑爆 localStorage）
  report(70, 'AI 暂不可用，用本地淡彩处理');
  const dataUrl = await finalizeSticker(await fallbackStylize(compressed));
  report(100, '完成');
  return { dataUrl, usedAI: false, failReason };
}
