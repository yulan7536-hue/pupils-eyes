/**
 * 地球仪的画质档位。
 *
 * 这个站会给学生手机用，所以按设备能力开特效，而不是一刀切最高配。
 * 刻意不读 WEBGL_debug_renderer_info：它在部分浏览器已被屏蔽、Apple 芯片常
 * 返回统一字符串，而且是明显的指纹采集面。只看几个行为特征就够。
 */

export type GlobeTier = 'high' | 'medium' | 'low';

export interface GlobeParams {
  tier: GlobeTier;
  /** 渲染缓冲区的像素比上限 */
  pixelRatio: number;
  antialias: boolean;
  /** 地球贴图尺寸 */
  earthTexture: [number, number];
  /** 法线贴图边长 */
  normalTexture: number;
  /** 各向异性上限（实际还会与硬件最大值取 min） */
  anisotropy: number;
  /** 环境贴图画布尺寸 */
  envSize: [number, number];
  /** 球面分段 [widthSegments, heightSegments] */
  sphere: [number, number];
  /** 铜弧截面分段 */
  arcRadialSegments: number;
  /** 铜弧沿弧长分段 */
  arcTubularSegments: number;
  /** 圆盘底座径向分段 */
  discSegments: number;
  /** 菲涅尔边缘光强度 */
  rimStrength: number;
  /** 平行光数量（低配减灯比降分辨率更省） */
  lights: 3 | 5;
  /** 渲染帧率上限 */
  targetFps: number;
}

/** 只在挂载时跑一次。拖动窗口改变 DPR 不换档——换档要重建材质，代价远大于收益。 */
export function pickGlobeTier(): GlobeTier {
  if (typeof window === 'undefined') return 'medium';

  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory;
  const dpr = window.devicePixelRatio || 1;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const shortEdge = Math.min(window.screen?.width ?? 1440, window.screen?.height ?? 900);
  const mobile = coarse || shortEdge <= 480;
  const lowMem = typeof mem === 'number' && mem <= 4;

  // 中低端手机：核心少、3x 屏、或内存吃紧
  if (mobile && (cores <= 4 || dpr >= 3 || lowMem)) return 'low';
  // 桌面主力机
  if (!mobile && cores >= 8 && !lowMem) return 'high';
  /*
   * 桌面上只把「真的很少核」的机器压到 low。
   * 4 核的老办公机很常见，落 low 会关掉 MSAA，在大屏上看轮廓全是锯齿 ——
   * 宁可少两盏灯，也别把抗锯齿关掉。
   */
  if (cores <= 2 || lowMem) return 'low';
  return 'medium';
}

export function getGlobeParams(tier: GlobeTier): GlobeParams {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

  if (tier === 'high') {
    return {
      tier,
      pixelRatio: Math.min(dpr, 2),
      antialias: true,
      earthTexture: [2048, 1024],
      normalTexture: 512,
      anisotropy: 8,
      envSize: [1024, 512],
      sphere: [96, 96],
      arcRadialSegments: 24,
      arcTubularSegments: 128,
      discSegments: 96,
      rimStrength: 0.16,
      lights: 5,
      targetFps: 60,
    };
  }

  if (tier === 'medium') {
    return {
      tier,
      pixelRatio: Math.min(dpr, 2),
      antialias: true,
      earthTexture: [1024, 512],
      normalTexture: 256,
      anisotropy: 4,
      envSize: [512, 256],
      sphere: [80, 64],
      arcRadialSegments: 16,
      arcTubularSegments: 96,
      discSegments: 64,
      rimStrength: 0.16,
      lights: 5,
      targetFps: 60,
    };
  }

  return {
    tier,
    pixelRatio: Math.min(dpr, 1.5),
    antialias: false,
    earthTexture: [1024, 512],
    normalTexture: 256,
    anisotropy: 2,
    envSize: [256, 128],
    sphere: [64, 48],
    arcRadialSegments: 12,
    arcTubularSegments: 72,
    discSegments: 48,
    rimStrength: 0.1,
    lights: 3,
    targetFps: 30,
  };
}
