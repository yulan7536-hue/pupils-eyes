/**
 * 钢笔淡彩（Line and Wash）风格化引擎 —— 纯本地、零网络、零费用。
 *
 * 为什么不用在线 AI：豆包要充值、Gemini 在国内直接返回
 * 「User location is not supported」，Pollinations 这类免费服务出图随机、
 * 且会把主体重画成别的东西（孩子的手工作品经常被判成"一坨花"）。
 * 这里改成自研管线，主体 100% 保留，只是"换一种画法"。
 *
 * 管线顺序（每步都为下一步服务，不能随意调换）：
 *   1. 双边滤波     —— 抹掉照片的细碎纹理，但保住轮廓，水彩不上细节
 *   2. 色调映射     —— 降饱和 + 提亮 + 暖偏移，压成马卡龙粉彩
 *   3. 色阶量化     —— 配 Bayer 抖动，出块面感而不是生硬色带
 *   4. 边缘分析     —— Sobel 梯度同时用于「水彩积色」和「墨线」
 *   5. 纸纹         —— 细颗粒 + 低频起伏，贴近水彩纸
 *
 * 输出保持不透明。透明背景由抠图蒙版在合成阶段处理，两者几何完全对齐，
 * 所以画风步骤完全不用关心 alpha，算法简单且快。
 */

export interface WatercolorOptions {
  /** 淡化（水感）0–1：越大颜色越浅、越通透。默认 0.55 */
  wash?: number;
  /** 墨线强度 0–1：0 完全不描线，1 是很重的钢笔线。默认 0.5 */
  ink?: number;
  /** 纸纹强度 0–1。默认 0.45 */
  paper?: number;
  /** 调色板色数：0 = 不做色彩归并（默认，最安全）；越大越像照片，越小越像插画 */
  colors?: number;
}

const DEFAULTS: Required<WatercolorOptions> = {
  wash: 0.5,
  ink: 0.45,
  paper: 0.5,
  colors: 0,
};

/** 墨线色：偏暖的深棕，比纯黑柔和（钢笔淡彩的惯用色） */
const INK_RGB: [number, number, number] = [74, 59, 50];

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * 分离式双边滤波：水平 → 垂直各一遍。
 *
 * 真双边是二维核（半径 r 就是 (2r+1)² 次采样），直角坐标下分离会引入误差，
 * 但视觉上几乎看不出来，速度却快一个数量级 —— 512 级别的贴纸完全够用。
 */
function bilateral(px: Uint8ClampedArray, w: number, h: number, radius: number, sigmaR: number): void {
  const tmp = new Uint8ClampedArray(px.length);

  // 空间权重：sigmaS 取半径的 0.8 倍，边缘过渡自然一些
  const sigmaS2 = 2 * (radius * 0.8) ** 2;
  const spatial: number[] = [];
  for (let d = -radius; d <= radius; d++) spatial.push(Math.exp(-(d * d) / sigmaS2));

  const invRange2 = 1 / (2 * sigmaR * sigmaR);

  // ---- 水平 ----
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = (row + x) * 4;
      const r0 = px[i];
      const g0 = px[i + 1];
      const b0 = px[i + 2];
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sw = 0;
      for (let d = -radius; d <= radius; d++) {
        const nx = x + d;
        if (nx < 0 || nx >= w) continue;
        const j = (row + nx) * 4;
        const dr = px[j] - r0;
        const dg = px[j + 1] - g0;
        const db = px[j + 2] - b0;
        // 颜色差越大权重越低 —— 这就是"保边"
        const wgt = spatial[d + radius] * Math.exp(-(dr * dr + dg * dg + db * db) * invRange2);
        sr += px[j] * wgt;
        sg += px[j + 1] * wgt;
        sb += px[j + 2] * wgt;
        sw += wgt;
      }
      tmp[i] = sr / sw;
      tmp[i + 1] = sg / sw;
      tmp[i + 2] = sb / sw;
      tmp[i + 3] = px[i + 3];
    }
  }

  // ---- 垂直 ----
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r0 = tmp[i];
      const g0 = tmp[i + 1];
      const b0 = tmp[i + 2];
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sw = 0;
      for (let d = -radius; d <= radius; d++) {
        const ny = y + d;
        if (ny < 0 || ny >= h) continue;
        const j = (ny * w + x) * 4;
        const dr = tmp[j] - r0;
        const dg = tmp[j + 1] - g0;
        const db = tmp[j + 2] - b0;
        const wgt = spatial[d + radius] * Math.exp(-(dr * dr + dg * dg + db * db) * invRange2);
        sr += tmp[j] * wgt;
        sg += tmp[j + 1] * wgt;
        sb += tmp[j + 2] * wgt;
        sw += wgt;
      }
      px[i] = sr / sw;
      px[i + 1] = sg / sw;
      px[i + 2] = sb / sw;
    }
  }
}

/** 亮度（Rec.601），Sobel 与明暗调整都用它 */
function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 马卡龙色调映射：逐像素。
 *
 * 三个动作：
 *  - 降饱和：照片的高饱和是"画"的最大敌人，压到 0.55 附近才有水彩的粉感；
 *  - 提亮 + 提暗部：水彩是"白纸上薄薄一层颜料"，暗部不该死黑；
 *  - 高光染米白：纸张本色的暖调，避免纯白像素显得脏。
 */
function pastelGrade(px: Uint8ClampedArray, wash: number): void {
  // 由 wash 推导：wash 越大越淡
  const satKeep = 1 - 0.12 * wash;
  const lift = 0.05 * wash;
  // 只抬暗部，不动亮部 —— 两头都压会让画面发灰
  const lo = 6 + 5 * wash;
  const hi = 255;

  for (let i = 0; i < px.length; i += 4) {
    let r = px[i];
    let g = px[i + 1];
    let b = px[i + 2];

    const l = luma(r, g, b);

    // 降饱和：向灰度插值
    r = r + (l - r) * (1 - satKeep);
    g = g + (l - g) * (1 - satKeep);
    b = b + (l - b) * (1 - satKeep);

    // 比较艳的颜色再额外压一道，压完才像"颜料兑了水"
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx <= 0 ? 0 : (mx - mn) / mx;
    if (sat > 0.72) {
      const extra = (sat - 0.72) * 0.4;
      r = r + (l - r) * extra;
      g = g + (l - g) * extra;
      b = b + (l - b) * extra;
    }

    // 明度压缩：整体往中间收，暗部不死黑、亮部不刺眼
    r = lo + (r / 255) * (hi - lo);
    g = lo + (g / 255) * (hi - lo);
    b = lo + (b / 255) * (hi - lo);

    // 提亮：暗部抬得比亮部多（伽马式提亮）
    const t = l / 255;
    const boost = 255 * lift * (1 - t) * (1 - t);
    r += boost;
    g += boost;
    b += boost;

    // 暖偏移：红多一点、蓝少一点，整体偏米黄（水彩纸 + 暖光）
    r += 2.5 * wash;
    g += 1 * wash;
    b -= 2 * wash;

    // 高光去脏：接近白的区域推向纸白（水彩的"留白"）
    const l2 = luma(r, g, b);
    if (l2 > 232) {
      const k = Math.min(1, (l2 - 232) / 23) * 0.5;
      r += (255 - r) * k;
      g += (253 - g) * k;
      b += (247 - b) * k;
    }

    px[i] = clamp255(r);
    px[i + 1] = clamp255(g);
    px[i + 2] = clamp255(b);
  }
}

/**
 * 从画面里学一套调色板（k-means 聚类）。
 *
 * 这是"照片 → 插画"最关键的一步。只做模糊和褪色，结果永远是"褪色的照片"；
 * 把整幅画归并成十几个主色，才会出现插画特有的色块与层次。
 *
 * 实现细节：
 *  - 每隔若干像素采样，最多 3000 个点（全图聚类要几秒，采样够用且快）；
 *  - k-means++ 初始化，避免落进局部最优；
 *  - 随机数用固定种子，保证同一张照片每次得到同一套配色 —— 否则拖滑块时
 *    颜色会莫名跳动，用户会以为出了 bug。
 */
function kmeansPalette(px: Uint8ClampedArray, w: number, h: number, k: number): Float32Array {
  const total = w * h;
  // 固定种子 LCG
  let seed = 0x2f6e2b1;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const stride = Math.max(1, Math.floor(total / 3000));
  const sample: number[] = [];
  for (let p = 0; p < total; p += stride) {
    const i = p * 4;
    if (px[i + 3] < 8) continue;
    sample.push(px[i], px[i + 1], px[i + 2]);
  }
  const n = sample.length / 3;
  if (n === 0) return new Float32Array(0);
  const K = Math.min(k, n);

  const centers = new Float32Array(K * 3);

  // —— k-means++：第一个中心随机，之后按「离已有中心越远越可能被选」 ——
  const pick = Math.floor(rnd() * n) * 3;
  centers[0] = sample[pick];
  centers[1] = sample[pick + 1];
  centers[2] = sample[pick + 2];

  const dist2 = new Float32Array(n);
  for (let c = 1; c < K; c++) {
    let sum = 0;
    for (let s = 0; s < n; s++) {
      const i = s * 3;
      let best = Infinity;
      for (let j = 0; j < c; j++) {
        const dr = sample[i] - centers[j * 3];
        const dg = sample[i + 1] - centers[j * 3 + 1];
        const db = sample[i + 2] - centers[j * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < best) best = d;
      }
      dist2[s] = best;
      sum += best;
    }
    let target = rnd() * sum;
    let chosen = 0;
    for (let s = 0; s < n; s++) {
      target -= dist2[s];
      if (target <= 0) {
        chosen = s;
        break;
      }
    }
    centers[c * 3] = sample[chosen * 3];
    centers[c * 3 + 1] = sample[chosen * 3 + 1];
    centers[c * 3 + 2] = sample[chosen * 3 + 2];
  }

  // —— 迭代 8 轮 ——
  const sums = new Float32Array(K * 3);
  const counts = new Uint32Array(K);
  for (let iter = 0; iter < 8; iter++) {
    sums.fill(0);
    counts.fill(0);
    for (let s = 0; s < n; s++) {
      const i = s * 3;
      let best = Infinity;
      let bestK = 0;
      for (let j = 0; j < K; j++) {
        const dr = sample[i] - centers[j * 3];
        const dg = sample[i + 1] - centers[j * 3 + 1];
        const db = sample[i + 2] - centers[j * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < best) {
          best = d;
          bestK = j;
        }
      }
      sums[bestK * 3] += sample[i];
      sums[bestK * 3 + 1] += sample[i + 1];
      sums[bestK * 3 + 2] += sample[i + 2];
      counts[bestK]++;
    }
    for (let j = 0; j < K; j++) {
      if (!counts[j]) continue;
      centers[j * 3] = sums[j * 3] / counts[j];
      centers[j * 3 + 1] = sums[j * 3 + 1] / counts[j];
      centers[j * 3 + 2] = sums[j * 3 + 2] / counts[j];
    }
  }
  return centers;
}

/**
 * 把每个像素拉到调色板色；边界处取最近的两个色按距离软混合。
 *
 * 为什么要软混合：直接取「最近色」会在色块交界留下锯齿和孤立的杂点，
 * 看起来像矢量图被硬切了一刀。水彩的色块边界是柔软的，靠两个色互相
 * 渗一点才自然。
 */
function applyPalette(px: Uint8ClampedArray, palette: Float32Array, strength: number): void {
  const K = palette.length / 3;
  if (!K || strength <= 0) return;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];

    let d1 = Infinity;
    let d2 = Infinity;
    let i1 = 0;
    let i2 = 0;
    for (let j = 0; j < K; j++) {
      const dr = r - palette[j * 3];
      const dg = g - palette[j * 3 + 1];
      const db = b - palette[j * 3 + 2];
      const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (d < d1) {
        d2 = d1;
        i2 = i1;
        d1 = d;
        i1 = j;
      } else if (d < d2) {
        d2 = d;
        i2 = j;
      }
    }

    const s1 = Math.sqrt(d1);
    const s2 = Math.sqrt(d2);
    // 离两色等距时 t≈0.5（最"骑墙"），贴着某一色时 t→0
    const t = s1 + s2 > 0 ? s1 / (s1 + s2) : 0;
    const w = Math.min(0.45, t * t * 1.2);

    const nr = palette[i1 * 3] * (1 - w) + palette[i2 * 3] * w;
    const ng = palette[i1 * 3 + 1] * (1 - w) + palette[i2 * 3 + 1] * w;
    const nb = palette[i1 * 3 + 2] * (1 - w) + palette[i2 * 3 + 2] * w;

    px[i] = r + (nr - r) * strength;
    px[i + 1] = g + (ng - g) * strength;
    px[i + 2] = b + (nb - b) * strength;
  }
}

/**
 * Sobel 边缘检测 → 归一化梯度 0–1。
 *
 * 输入是灰度数组而不是像素：墨线要跟着「真实物体的轮廓」走。
 * 如果拿量化后的色块图求梯度，画出来的线会黏在色块锯齿上，一眼假。
 */
function sobelFromGray(gray: Float32Array, w: number, h: number): Float32Array {
  // 先 3×3 均值去噪，否则照片颗粒会变成满屏碎线
  const smooth = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        smooth[p] = gray[p];
        continue;
      }
      smooth[p] =
        (gray[p - w - 1] +
          gray[p - w] +
          gray[p - w + 1] +
          gray[p - 1] +
          gray[p] +
          gray[p + 1] +
          gray[p + w - 1] +
          gray[p + w] +
          gray[p + w + 1]) /
        9;
    }
  }

  const edge = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const tl = smooth[p - w - 1];
      const t = smooth[p - w];
      const tr = smooth[p - w + 1];
      const l = smooth[p - 1];
      const r = smooth[p + 1];
      const bl = smooth[p + w - 1];
      const bm = smooth[p + w];
      const br = smooth[p + w + 1];
      const gx = -tl - 2 * l - bl + tr + 2 * r + br;
      const gy = -tl - 2 * t - tr + bl + 2 * bm + br;
      edge[p] = Math.min(1, Math.sqrt(gx * gx + gy * gy) / 230);
    }
  }
  // 线宽膨胀：1px 的细线一缩小就看不见了，钢笔线本来就带笔尖厚度
  const thick = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      let m = edge[p];
      if (edge[p - 1] > m) m = edge[p - 1];
      if (edge[p + 1] > m) m = edge[p + 1];
      if (edge[p - w] > m) m = edge[p - w];
      if (edge[p + w] > m) m = edge[p + w];
      thick[p] = m;
    }
  }
  return thick;
}

/**
 * 取梯度图的某个分位数。
 *
 * 阈值不能写死：安静的风景图整体梯度都很低，写死会把整张图涂黑；
 * 而积木、花丛这种满屏纹理的图，任何像素梯度都很高，写死又会满屏是线。
 * 按分位数取，才能保证"永远只描最强的那一小撮边缘"。
 */
function percentile(edge: Float32Array, p: number): number {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < edge.length; i++) {
    if (edge[i] <= 0) continue;
    hist[Math.min(255, (edge[i] * 255) | 0)]++;
    n++;
  }
  if (!n) return 1;
  const target = n * p;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= target) return i / 255;
  }
  return 1;
}

/** 叠加墨线与积色（用乘法混合，让线条"沁"进颜色里而不是浮在上面） */
function applyInk(px: Uint8ClampedArray, edge: Float32Array, inkStrength: number): void {
  if (inkStrength <= 0) return;

  // 自适应阈值：积色取前 45%，墨线取最强的 12%
  const t2 = Math.max(0.08, percentile(edge, 0.88));
  const t1 = Math.max(0.02, percentile(edge, 0.55));

  for (let p = 0; p < edge.length; p++) {
    const e = edge[p];
    if (e < t1) continue;
    const i = p * 4;
    if (px[i + 3] === 0) continue;

    // 1) 边缘积色：水彩干了以后，颜料会在色块边缘堆一圈更浓的色
    //    只做很轻的一点 —— 过头了整幅画会发灰、发脏
    const grad = Math.min(1, (e - t1) / Math.max(1e-4, t2 - t1)) * 0.1;
    const dark = 1 - 0.1 * grad;
    px[i] = clamp255(px[i] * dark);
    px[i + 1] = clamp255(px[i + 1] * dark);
    px[i + 2] = clamp255(px[i + 2] * dark);

    // 2) 墨线：只在强边缘落笔，浓度平滑过渡，避免锯齿
    if (e > t2) {
      const a = Math.min(1, (e - t2) / Math.max(1e-4, 1 - t2)) * inkStrength * 0.9;
      if (a > 0.01) {
        px[i] = px[i] * (1 - a) + INK_RGB[0] * a;
        px[i + 1] = px[i + 1] * (1 - a) + INK_RGB[1] * a;
        px[i + 2] = px[i + 2] * (1 - a) + INK_RGB[2] * a;
      }
    }
  }
}

/** 纸纹：细颗粒 + 低频起伏。用确定性伪随机，保证同一张图每次结果一致 */
function addPaperGrain(px: Uint8ClampedArray, w: number, h: number, strength: number): void {
  if (strength <= 0) return;
  let seed = 0x9e3779b9;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };

  // 低频起伏：每 7px 一格插值，模拟纸张的不平整
  const gw = Math.ceil(w / 7) + 1;
  const gh = Math.ceil(h / 7) + 1;
  const low = new Float32Array(gw * gh);
  for (let i = 0; i < low.length; i++) low[i] = rand();

  const amp = 7 * strength;
  for (let y = 0; y < h; y++) {
    const gy = y / 7;
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = x / 7;
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const i00 = y0 * gw + x0;
      const v =
        (low[i00] * (1 - fx) + low[i00 + 1] * fx) * (1 - fy) +
        (low[i00 + gw] * (1 - fx) + low[i00 + gw + 1] * fx) * fy;

      const p = (y * w + x) * 4;
      const d = (v * 0.6 + rand() * 0.4) * amp;
      px[p] = clamp255(px[p] + d);
      px[p + 1] = clamp255(px[p + 1] + d);
      px[p + 2] = clamp255(px[p + 2] + d);
    }
  }
}

/**
 * 主入口：把任意图片画成钢笔淡彩。
 *
 * @param source 图片（File / Blob / Canvas / ImageBitmap 皆可）
 * @param opts   风格参数
 * @param maxEdge 处理尺寸上限（默认 720，最终贴纸 512，留一点余量足够）
 */
export async function watercolorize(
  source: CanvasImageSource & { width: number; height: number },
  opts: WatercolorOptions = {},
  maxEdge = 640
): Promise<HTMLCanvasElement> {
  const o = { ...DEFAULTS, ...opts };
  const sw = source.width;
  const sh = source.height;
  const k = Math.min(1, maxEdge / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;

  /**
   * 透明区域先把 RGB 换成纸白，并备份原始 alpha。
   *
   * 抠图后的 PNG 在背景处 RGB 是 (0,0,0) —— 直接滤波会把黑色混进主体边缘，
   * 形成一圈脏灰边（这是"抠图贴纸发黑"的经典成因）。填成纸白后，
   * 边缘会自然晕成浅色，接近水彩画留白的观感。最后再把 alpha 还原回去。
   */
  const alpha = new Uint8ClampedArray(w * h);
  /** 平滑前的灰度：墨线以它为基准，线条才贴得住真实轮廓 */
  const gray0 = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    alpha[p] = px[i + 3];
    if (px[i + 3] < 8) {
      px[i] = 252;
      px[i + 1] = 249;
      px[i + 2] = 244;
    }
    gray0[p] = luma(px[i], px[i + 1], px[i + 2]);
  }

  // 1) 保边平滑
  //    半径是个取舍：太大能抹平光照渐变（更像画），但画面里物体很小时
  //    核会跨过相邻物体，把红黄蓝互相搅成土色。这里取"只抹细节、不串色"的值。
  const radius = Math.max(3, Math.round(Math.min(w, h) / 90));
  bilateral(px, w, h, radius, 22);
  bilateral(px, w, h, Math.max(2, Math.round(radius / 2)), 16);

  // 2) 色调
  pastelGrade(px, o.wash);

  // 3) 可选的色彩归并
  //    注意：k-means 量化对"多彩画面"是灾难 —— 红黄蓝会被平均成土褐色。
  //    所以默认关闭（colors=0），只在用户主动要求更"插画"时才用。
  if (o.colors > 0) {
    const palette = kmeansPalette(px, w, h, o.colors);
    applyPalette(px, palette, 0.55 + 0.35 * o.wash);
  }

  // 4) 墨线 + 积色（梯度取自原图，线才贴真实轮廓）
  const edge = sobelFromGray(gray0, w, h);
  applyInk(px, edge, o.ink);

  // 5) 纸纹
  addPaperGrain(px, w, h, o.paper);

  // 还原抠图的 alpha：画风只改颜色，不该改变主体的边界
  for (let p = 0; p < w * h; p++) px[p * 4 + 3] = alpha[p];

  ctx.putImageData(img, 0, 0);
  return canvas;
}
