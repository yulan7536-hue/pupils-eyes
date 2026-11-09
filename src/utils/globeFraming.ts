import * as THREE from 'three';

/**
 * 地球仪的自动取景。
 *
 * 之前是在注释里手解二元一次方程，只兜「球顶 2.034」和「底座最低点 2.890」两个点。
 * 外面那圈铜弧外缘最高到 2.335，从来没进过方程 —— 画布上边缘正好切在弧顶上，
 * 看起来就是地球仪顶部被削平。而且 LIFT 是在解完方程之后又叠加的，等于解完再抬一次。
 *
 * 手解已经错过两次（底座一次、铜弧一次），所以改成：
 * 从几何顶点采样 → 投影求极值 → 两层二分反解相机。
 * 以后改底座、换弧半径都不用再回来改这里。
 */

export interface FramingOptions {
  /** 顶部留白占画布高的比例 */
  marginTop?: number;
  /** 底部留白占画布高的比例 */
  marginBottom?: number;
  /** 左右留白（正方形画布一般不是约束） */
  marginSide?: number;
  /** 俯角（弧度）。保持现有观感：底座圆盘能读出椭圆 */
  pitch?: number;
}

export interface FramingResult {
  /** 相机到目标点的距离 */
  d: number;
  /** 相机看向的高度 */
  targetY: number;
  /** 内容投影后的 NDC 极值（±1 即画布上下边） */
  top: number;
  bottom: number;
  xMax: number;
  pitch: number;
}

const _v = new THREE.Vector3();

/** 深度小于这个值的点已经贴到镜头上了，这一档 d 无效 */
const MIN_DEPTH = 0.5;

function walk(root: THREE.Object3D, out: THREE.Vector3[]) {
  // noFrame 是"整棵子树都不参与取景"：拾取球、光晕、AO 精灵都在此列
  if (root.userData?.noFrame) return;

  const mesh = root as THREE.Mesh;
  const pos = mesh.geometry?.attributes?.position as THREE.BufferAttribute | undefined;
  if (mesh.isMesh && pos) {
    const inflate = (mesh.userData.frameInflate as number) ?? 1;
    // 球有 9409 个顶点，抽到 2000 个就够：凸体轮廓误差 < R·(1-cos1.9°) ≈ 1e-3
    const stride = pos.count > 2400 ? Math.ceil(pos.count / 2000) : 1;
    for (let i = 0; i < pos.count; i += stride) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (inflate !== 1) _v.multiplyScalar(inflate);
      out.push(_v.clone());
    }
  }

  for (const child of root.children) walk(child, out);
}

/**
 * 把场景里所有实心几何的顶点收成取景采样点。
 *
 * 必须吃几何顶点，不能手写"最高点/最低点"：圆柱底座靠镜头那一侧的前沿，
 * 透视放大后比轴心下沿还低一截，只取轴线上的点会漏掉这一块。
 */
export function collectFrameSamples(root: THREE.Object3D): THREE.Vector3[] {
  // 不先刷新矩阵的话，matrixWorld 全是单位阵，所有点挤在原点，解出来的 d 会是下界
  root.updateMatrixWorld(true);
  const out: THREE.Vector3[] = [];
  walk(root, out);
  return out;
}

/**
 * 反解相机。
 *
 * 相机永远沿同一个俯角看目标点，于是：
 *   pos = (0, targetY + d·sinP, d·cosP)，lookAt(0, targetY, 0)
 * 投影可以写成解析式（与 three 的 perspectiveMatrix 等价，已按像素尺寸无关验证）：
 *   a      = P.y - targetY
 *   depth  = d - (a·sinP + P.z·cosP)
 *   ndc.y  = (a·cosP - P.z·sinP) / (tan(fov/2) · depth)
 *
 * ndc.y 对 targetY 单调递减、对 d 单调递增，所以两层二分收敛得很干净：
 * 1) 给定 d，二分 targetY 让最高点正好落在顶部留白线；
 * 2) 对 d 二分，找让最低点正好落在底部留白线的最小 d（= 最大画幅）。
 */
export function frameGlobeCamera(
  camera: THREE.PerspectiveCamera,
  pts: THREE.Vector3[],
  options: FramingOptions = {}
): FramingResult {
  const marginTop = options.marginTop ?? 0.05;
  const marginBottom = options.marginBottom ?? 0.02;
  const marginSide = options.marginSide ?? 0.03;
  const pitch = options.pitch ?? Math.atan(0.64 / 7.705);

  const S = Math.sin(pitch);
  const C = Math.cos(pitch);
  const th = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const TOP = 1 - marginTop;
  const BOT = -1 + marginBottom;
  const SIDE = 1 - marginSide;

  let yMax = 0;
  let yMin = 0;
  let xMax = 0;

  const measure = (d: number, targetY: number): boolean => {
    yMax = -Infinity;
    yMin = Infinity;
    xMax = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const a = p.y - targetY;
      const depth = d - (a * S + p.z * C);
      if (depth < MIN_DEPTH) return false;
      const inv = 1 / (th * depth);
      const y = (a * C - p.z * S) * inv;
      if (y > yMax) yMax = y;
      if (y < yMin) yMin = y;
      const ax = Math.abs(p.x) * inv;
      if (ax > xMax) xMax = ax;
    }
    return true;
  };

  /** 给定 d，二分 targetY 让最高点压在 TOP 上（targetY 抬高 → 画面整体下移） */
  const solveTargetY = (d: number): number => {
    let lo = -6;
    let hi = 6;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) * 0.5;
      if (!measure(d, mid)) {
        lo = mid;
        continue;
      }
      if (yMax > TOP) lo = mid;
      else hi = mid;
    }
    return (lo + hi) * 0.5;
  };

  // 这一档 d 下的完整测量（targetY 现解现用，避免拿着上一次的极值做判断）
  const measureAt = (d: number) => {
    const targetY = solveTargetY(d);
    const ok = measure(d, targetY);
    return { ok, targetY };
  };

  let lo = 5;
  let hi = 30;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) * 0.5;
    const { ok } = measureAt(mid);
    if (!ok) {
      lo = mid;
      continue;
    }
    if (yMin > BOT) hi = mid;
    else lo = mid;
  }
  let d = (lo + hi) * 0.5;
  let targetY = solveTargetY(d);
  measure(d, targetY);

  // 正方形画布下左右一般不是约束（实测 xMax ≈ 0.79），保险起见再核一次
  if (xMax > SIDE) {
    let l2 = d;
    let h2 = 30;
    for (let i = 0; i < 20; i++) {
      const mid = (l2 + h2) * 0.5;
      const { ok } = measureAt(mid);
      if (!ok) {
        l2 = mid;
        continue;
      }
      if (xMax > SIDE) l2 = mid;
      else h2 = mid;
    }
    d = (l2 + h2) * 0.5;
    targetY = solveTargetY(d);
    measure(d, targetY);
  }

  camera.position.set(0, targetY + d * S, d * C);
  // 内容深度实测 5.5 – 10.5：near 从 0.1 提到 2，深度精度翻 20 倍，小灯不再 z-fight
  camera.near = 2;
  camera.far = 24;
  camera.lookAt(0, targetY, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  return { d, targetY, top: yMax, bottom: yMin, xMax, pitch };
}
