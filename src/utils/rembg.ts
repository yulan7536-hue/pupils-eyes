/**
 * 本地 AI 抠图（浏览器端运行，不上传照片）。
 *
 * 用 @imgly/background-removal 的 ISNet 模型：一个在 ONNX Runtime Web 上跑的
 * 语义分割网络，能识别"这张照片里最主要的东西"并把它从背景里分离出来。
 *
 * 为什么是它：
 *  - 完全免费、不需要任何 Key，也就不会遇到「账户欠费」；
 *  - 照片不出本机，孩子的人像照片不上传，家长更放心；
 *  - 模型（56MB）由我们自己托管在 /rembg/，不依赖境外 CDN。
 *
 * 代价是首次使用要下载 56MB 模型。已经下载过一次就进 Cache Storage，
 * 之后打开秒级可用（库本身不做缓存，缓存层是我们自己补的）。
 */

const CACHE_NAME = 'pupils-eyes-rembg-v1';
/** 模型分块都是 4MB，给足上限避免 iOS 因单条超限而失败 */
const MODEL_BYTES = 56 * 1024 * 1024;

export interface CutoutProgress {
  /** 0–1 */
  pct: number;
  /** 给用户看的一句话 */
  label: string;
}

let cachePatched = false;

/** 资源目录：相对页面 base 解析成绝对 URL（构建用 './'，不能写死根路径） */
function resourceBase(): string {
  return new URL('rembg/', document.baseURI).href;
}

/**
 * 给 rembg 的资源请求加 Cache Storage 缓存。
 *
 * 库内部直接用全局 fetch 读 resources.json 和各个分块，本身没有缓存，
 * 所以这里包一层：命中缓存直接返回，未命中才走网络并写回。
 * 只拦自己的资源目录，其它请求原样放行。
 */
function patchFetchCache(base: string): void {
  if (cachePatched || typeof caches === 'undefined' || typeof window === 'undefined') return;
  cachePatched = true;

  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (!url.startsWith(base) || (init?.method && init.method !== 'GET')) {
      return original(input as RequestInfo, init);
    }

    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      if (hit) return hit;

      const res = await original(input as RequestInfo, init);
      if (res.ok && res.status === 200) {
        // 不 await：缓存写入失败也不影响本次使用
        void cache.put(url, res.clone()).catch(() => undefined);
      }
      return res;
    } catch {
      // 缓存不可用（隐私模式 / 容量不足）时退回裸请求
      return original(input as RequestInfo, init);
    }
  };
}

/** 把 resources.json 的总字节数估出来，给进度条一个分母 */
function estimateTotal(meta: unknown): number {
  const map = meta as Record<string, { size?: number }> | null;
  if (!map) return MODEL_BYTES;
  let sum = 0;
  for (const v of Object.values(map)) sum += v?.size ?? 0;
  return sum > 0 ? sum : MODEL_BYTES;
}

/**
 * 抠图：返回去掉背景的 PNG Blob（保持原图尺寸）。
 *
 * @param image 原图（File / Blob / dataURL 均可）
 */
export async function aiCutout(
  image: Blob,
  onProgress?: (p: CutoutProgress) => void
): Promise<Blob> {
  const base = resourceBase();
  patchFetchCache(base);

  // 动态引入：onnxruntime 体积不小，不让它拖慢首屏
  const { removeBackground } = await import('@imgly/background-removal');

  // 先把清单读回来，用来算下载进度（库自己的 progress 只有块序号）
  let total = MODEL_BYTES;
  try {
    const meta = await fetch(new URL('resources.json', base).toString()).then((r) => r.json());
    total = estimateTotal(meta);
  } catch {
    /* 读不到就用默认值 */
  }

  let lastPct = 0;
  const blob = await removeBackground(image, {
    publicPath: base,
    // 量化版：56MB，画质与 fp16 肉眼几乎无差，体积只有一半多一点
    model: 'isnet_quint8',
    device: 'cpu',
    output: { format: 'image/png' },
    progress: (key, current, currentTotal) => {
      if (!onProgress) return;
      const downloaded = Math.max(0, current);
      const span = Math.max(1, currentTotal || 1);
      if (key.includes('isnet')) {
        // 模型分块：按块数折算体积
        const approx = Math.min(1, (downloaded / span) * 0.95);
        if (approx - lastPct > 0.02 || approx === 1) {
          lastPct = approx;
          onProgress({ pct: approx, label: '正在下载抠图模型（仅首次）' });
        }
      } else {
        onProgress({ pct: Math.min(0.3, downloaded / span * 0.3), label: '正在启动抠图引擎' });
      }
    },
  });

  onProgress?.({ pct: 1, label: '主体已分离' });
  void total;
  return blob;
}

/** 预热：用户打开贴纸面板时后台把模型拉下来，真正点"抠图"时就不用等 */
export async function warmupCutout(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const base = resourceBase();
    const meta = await fetch(new URL('resources.json', base).toString())
      .then((r) => r.json())
      .catch(() => null);
    if (!meta) return;

    const names: string[] = [];
    for (const entry of Object.values(meta as Record<string, { chunks?: { name: string }[] }>)) {
      for (const c of entry.chunks ?? []) names.push(c.name);
    }

    // 只有全部命中才算预热过；缺一个就整体补齐，避免半加载状态
    for (const n of names) {
      const url = new URL(n, base).toString();
      if (await cache.match(url)) continue;
      const res = await fetch(url);
      if (res.ok) await cache.put(url, res.clone());
    }
  } catch {
    /* 预热失败无所谓，真正抠图时会重新拉 */
  }
}

/** 缓存是否已就绪（决定要不要显示"首次使用需下载模型"的提示） */
export async function isModelCached(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    // 15 个文件（模型 11 + wasm 3 + mjs 1），少一个都会重新下载
    return keys.length >= 15;
  } catch {
    return false;
  }
}
