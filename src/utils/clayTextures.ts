import * as THREE from 'three';

/**
 * 纯代码生成的水彩贴图。
 * 1) 地球底色：把简化大陆画进等距圆柱投影，再压上水彩晕染、干笔触与纸张颗粒；大陆边缘留一圈"颜料回渗"的水迹。
 * 2) 法线：低频噪声起伏，模拟纸面的细微纹理。
 * 色调全部落在水彩绘本区间（青蓝海、暖赭/芥末陆地、焦赭高地）。
 */

/* 水彩绘本色板：青蓝海 + 暖赭/芥末大陆，暖纸白留白，少量 dusty rose / deep navy 点缀 */
const OCEAN = '#8ecfe8';
const OCEAN_DEEP = '#5fb3d6';
const LAND = '#e6c07a';
const LAND_DEEP = '#d19a5c';
const LAND_LIT = '#f2d59a';
const OCHRE = '#e8b98a';
const ROSE = '#d9a3a0';
const NAVY = '#5b7c8c';
const ICE = '#fbf7ea';

/** 经纬度 → 等距圆柱像素 */
const px = (lon: number, w: number) => ((lon + 180) / 360) * w;
const py = (lat: number, h: number) => ((90 - lat) / 180) * h;

type Poly = [number, number][];

/**
 * 固定种子的伪随机。
 * 水彩斑块与纸颗粒原来是 Math.random()，每次刷新位置都变 —— 既让人以为贴图在闪，
 * 也没法对比调优。固定种子之后每次生成的纹理完全一致。
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONTINENTS: { pts: Poly; color: string; alpha?: number; line?: boolean }[] = [
  {
    // 欧亚大陆（粗形，只求可辨）
    color: LAND,
    pts: [
      [-9, 43], [0, 51], [8, 57], [20, 60], [30, 62], [42, 60], [60, 62], [78, 60],
      [95, 58], [110, 56], [125, 52], [140, 50], [148, 44], [140, 38], [126, 34],
      [121, 26], [110, 20], [104, 10], [100, 4], [96, 12], [88, 21], [80, 12],
      [73, 20], [66, 25], [57, 28], [48, 30], [42, 33], [36, 36], [28, 36],
      [22, 33], [14, 38], [4, 43], [-4, 43],
    ],
  },
  {
    // 非洲
    color: LAND,
    pts: [
      [-17, 20], [-5, 32], [10, 34], [24, 32], [33, 30], [42, 12], [40, -2],
      [35, -18], [26, -33], [18, -34], [12, -18], [9, 0], [2, 5], [-8, 5], [-16, 12],
    ],
  },
  {
    // 北美
    color: LAND,
    pts: [
      [-166, 66], [-140, 70], [-110, 71], [-85, 66], [-62, 60], [-56, 48],
      [-70, 44], [-82, 30], [-97, 19], [-105, 24], [-118, 32], [-126, 44],
      [-136, 58], [-152, 60],
    ],
  },
  {
    // 南美
    color: LAND_DEEP,
    pts: [
      [-81, 9], [-62, 11], [-48, 0], [-35, -6], [-38, -22], [-52, -32],
      [-68, -48], [-75, -38], [-72, -18], [-79, 0],
    ],
  },
  {
    // 澳洲
    color: LAND_LIT,
    pts: [
      [113, -22], [129, -12], [143, -14], [153, -27], [146, -38], [131, -32], [116, -34],
    ],
  },
  {
    // 格陵兰
    color: LAND_LIT,
    pts: [
      [-45, 80], [-22, 81], [-24, 68], [-46, 62], [-58, 72],
    ],
  },
  {
    // 青藏高原（浅土黄，给中国区域一个视觉落点）
    color: OCHRE,
    // 半透明：满不透明的一块赭石压在陆地上像块污渍，化开一点才像水彩叠色
    alpha: 0.5,
    // 不勾海岸线：它是叠在陆地上的色斑，描边会变成一个泡泡
    line: false,
    pts: [
      [74, 38], [86, 40], [100, 38], [102, 30], [94, 26], [80, 28], [74, 32],
    ],
  },
  {
    // 撒哈拉
    color: OCHRE,
    alpha: 0.42,
    line: false,
    pts: [
      [16, 26], [30, 28], [36, 20], [30, 14], [18, 16],
    ],
  },
];

/**
 * 把多边形画成圆角曲线：每个顶点替换成「前一条边的中点 → 顶点 → 后一条边的中点」
 * 的二次曲线。黏土里的大陆没有直角，这一步决定了它是"泥块"还是"多边形"。
 */
function polyPath(ctx: CanvasRenderingContext2D, pts: Poly, w: number, h: number) {
  const P = pts.map(([lon, lat]) => [px(lon, w), py(lat, h)] as [number, number]);
  const n = P.length;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  ctx.beginPath();
  const start = mid(P[n - 1], P[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const cur = P[i];
    const m = mid(cur, P[(i + 1) % n]);
    ctx.quadraticCurveTo(cur[0], cur[1], m[0], m[1]);
  }
  ctx.closePath();
}

export function createClayEarthTexture(
  width = 2048,
  height = 1024,
  anisotropy = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(0x9e3779b9);

  if (ctx) {
    // 海：青蓝底色上叠一块块水彩「晕染斑」（bloom），颜料在水里化开，边缘不是硬圆
    ctx.fillStyle = OCEAN;
    ctx.fillRect(0, 0, width, height);

    /**
     * 圆形晕染。左右各多画一份（±width）：跨 180° 经线的斑块本来会在接缝处
     * 被切出一条直边，球转到背面时那道缝正好露在正中间。
     */
    const bloom = (
      cx: number,
      cy: number,
      r: number,
      inner: number,
      stops: [number, string][]
    ) => {
      for (const dx of [-width, 0, width]) {
        const g = ctx.createRadialGradient(cx + dx, cy, inner, cx + dx, cy, r);
        for (const [at, color] of stops) g.addColorStop(at, color);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx + dx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    for (let i = 0; i < 26; i++) {
      const cx = rand() * width;
      const cy = rand() * height;
      const r = 90 + rand() * 240;
      // 深青蓝水洗，向四周褪到透明
      bloom(cx, cy, r, r * 0.1, [
        [0, 'rgba(95, 179, 214, 0.72)'],
        [0.5, 'rgba(95, 179, 214, 0.34)'],
        [1, 'rgba(95, 179, 214, 0)'],
      ]);
    }

    // 少量 deep navy 深色水洗点缀，压出海的层次，又不抢大陆
    for (let i = 0; i < 10; i++) {
      const cx = rand() * width;
      const cy = rand() * height;
      const r = 60 + rand() * 150;
      bloom(cx, cy, r, 0, [
        [0, 'rgba(91, 124, 140, 0.34)'],
        [1, 'rgba(91, 124, 140, 0)'],
      ]);
    }

    // 左上到右下的淡色水洗，制造「颜料褪到纸张」的留白感
    const wash = ctx.createLinearGradient(0, 0, width * 0.7, height);
    wash.addColorStop(0, 'rgba(251, 247, 234, 0.5)');
    wash.addColorStop(0.5, 'rgba(251, 247, 234, 0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);

    /*
     * 极冰：北极用渐变收边，不再 fillRect 一刀切。
     * 硬边在球顶会投影成一圈生硬的圆，而球顶恰好是等距投影压缩最厉害、
     * 最容易糊成一块的地方，硬边会把这个问题放大。
     */
    const northEnd = py(70, height);
    const northGrad = ctx.createLinearGradient(0, 0, 0, northEnd);
    northGrad.addColorStop(0, ICE);
    northGrad.addColorStop(0.45, 'rgba(251, 247, 234, 0.9)');
    northGrad.addColorStop(1, 'rgba(251, 247, 234, 0)');
    ctx.fillStyle = northGrad;
    ctx.fillRect(0, 0, width, northEnd);

    // 冰缘的笔刷毛边：24 条短弧，让渐变边界读起来像笔扫过，而不是喷雾
    ctx.strokeStyle = 'rgba(251, 247, 234, 0.5)';
    ctx.lineWidth = 2.4;
    const iceTop = py(78, height);
    const iceBottom = py(66, height);
    for (let i = 0; i < 24; i++) {
      const y = iceTop + rand() * (iceBottom - iceTop);
      const x = rand() * width;
      const len = 30 + rand() * 90;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len * 0.5, y - 8 - rand() * 10, x + len, y + rand() * 6);
      ctx.stroke();
    }

    const southTop = py(-64, height); // 渐变起点（较北、更靠近赤道）
    const southBottom = height; // 球底
    const southGrad = ctx.createLinearGradient(0, southTop, 0, southBottom);
    southGrad.addColorStop(0, 'rgba(251, 247, 234, 0)');
    southGrad.addColorStop(0.35, 'rgba(251, 247, 234, 0.55)');
    southGrad.addColorStop(1, 'rgba(251, 247, 234, 0.95)');
    ctx.fillStyle = southGrad;
    ctx.fillRect(0, southTop, width, southBottom - southTop);

    // 大陆：先描一圈淡色「水迹边」（颜料在边缘堆积回渗），再压上本体的暖色
    CONTINENTS.forEach(({ pts, color, alpha = 1, line = true }) => {
      ctx.save();
      ctx.translate(5, 6);
      polyPath(ctx, pts, width, height);
      ctx.fillStyle = 'rgba(214, 166, 96, 0.3)';
      ctx.fill();
      ctx.restore();

      polyPath(ctx, pts, width, height);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();

      /*
       * 海岸线：宽而淡的一圈 + 细而实的一条。
       * 只填色不勾线，大陆在放大态就是一块色斑；一圈赭色墨线立刻把它读成
       * "画出来的地方"，也跟整站的墨线风格对上。宽度按画布尺寸缩放。
       */
      if (line) {
        const scale = width / 2048;
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(150, 104, 58, 0.16)';
        ctx.lineWidth = 6 * scale;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(132, 88, 46, 0.34)';
        ctx.lineWidth = 1.9 * scale;
        ctx.stroke();
        ctx.restore();
      }

      // 泥块内部的明暗：改用水彩晕染（柔边径向渐变），不是硬边椭圆
      ctx.save();
      polyPath(ctx, pts, width, height);
      ctx.clip();
      const b = pts.reduce(
        (acc, [lon, lat]) => {
          acc.minLon = Math.min(acc.minLon, lon);
          acc.maxLon = Math.max(acc.maxLon, lon);
          acc.minLat = Math.min(acc.minLat, lat);
          acc.maxLat = Math.max(acc.maxLat, lat);
          return acc;
        },
        { minLon: 180, maxLon: -180, minLat: 90, maxLat: -90 }
      );
      const cx = px((b.minLon + b.maxLon) / 2, width);
      const cy = py((b.minLat + b.maxLat) / 2, height);
      const rw = (px(b.maxLon, width) - px(b.minLon, width)) * 0.5;
      const rh = (py(b.minLat, height) - py(b.maxLat, height)) * 0.5;

      // 受光面：浅芥末的柔光晕染
      const lit = ctx.createRadialGradient(
        cx - rw * 0.28, cy - rh * 0.34, rw * 0.05,
        cx - rw * 0.28, cy - rh * 0.34, rw * 0.9
      );
      lit.addColorStop(0, 'rgba(242, 213, 154, 0.5)');
      lit.addColorStop(1, 'rgba(242, 213, 154, 0)');
      ctx.fillStyle = lit;
      ctx.beginPath();
      ctx.arc(cx - rw * 0.28, cy - rh * 0.34, rw * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // 背光面：焦赭的柔光晕染
      const shadow = ctx.createRadialGradient(
        cx + rw * 0.34, cy + rh * 0.42, rw * 0.05,
        cx + rw * 0.34, cy + rh * 0.42, rw * 0.95
      );
      shadow.addColorStop(0, 'rgba(209, 154, 92, 0.4)');
      shadow.addColorStop(1, 'rgba(209, 154, 92, 0)');
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(cx + rw * 0.34, cy + rh * 0.42, rw * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // 一点 dusty rose 点缀，让大陆边缘透出暖意
      const rose = ctx.createRadialGradient(
        cx + rw * 0.1, cy + rh * 0.15, 0,
        cx + rw * 0.1, cy + rh * 0.15, rw * 0.7
      );
      rose.addColorStop(0, 'rgba(217, 163, 160, 0.22)');
      rose.addColorStop(1, 'rgba(217, 163, 160, 0)');
      ctx.fillStyle = rose;
      ctx.beginPath();
      ctx.arc(cx + rw * 0.1, cy + rh * 0.15, rw * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 干笔触：低透明度的短弧线，模拟画笔在纸面上快速扫过的痕迹
    for (let i = 0; i < 46; i++) {
      ctx.strokeStyle =
        i % 2 === 0 ? 'rgba(235, 245, 246, 0.06)' : 'rgba(120, 156, 172, 0.06)';
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      const sx = rand() * width;
      const sy = rand() * height;
      ctx.arc(sx, sy, 18 + rand() * 66, rand() * Math.PI, rand() * Math.PI + 1.1);
      ctx.stroke();
    }

    // 纸面颗粒：水彩的 granulation，细小半透明噪点，比黏土的纯色方块更轻
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    for (let i = 0; i < 2400; i++) {
      ctx.fillRect(rand() * width, rand() * height, 1.6, 1.6);
    }
    ctx.fillStyle = 'rgba(96, 122, 132, 0.09)';
    for (let i = 0; i < 1700; i++) {
      ctx.fillRect(rand() * width, rand() * height, 2, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  // 球顶/球底正是掠射角最大的地方，最吃各向异性过滤。实际值由调用方按档位取 min(硬件上限)
  texture.anisotropy = anisotropy;
  return texture;
}

/** 低频噪声法线：软陶表面被指腹压出的起伏 */
export function createClayNormalTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const field = new Float32Array(size * size);
    const waves = [
      { f: 3.1, a: 0.5, p: 0.7 },
      { f: 7.3, a: 0.28, p: 2.1 },
      { f: 15.7, a: 0.14, p: 4.3 },
      { f: 31.1, a: 0.07, p: 1.2 },
    ];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0;
        for (const w of waves) {
          v +=
            w.a *
            Math.sin((x / size) * Math.PI * 2 * w.f + w.p) *
            Math.cos((y / size) * Math.PI * 2 * w.f * 0.87 + w.p * 1.7);
        }
        field[y * size + x] = v;
      }
    }

    const img = ctx.createImageData(size, size);
    const strength = 2.4;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const dx = field[y * size + ((x + 1) % size)] - field[y * size + ((x - 1 + size) % size)];
        const dy = field[((y + 1) % size) * size + x] - field[((y - 1 + size) % size) * size + x];
        const nx = -dx * strength;
        const ny = -dy * strength;
        const nz = 1;
        const len = Math.hypot(nx, ny, nz);
        img.data[i * 4] = ((nx / len) * 0.5 + 0.5) * 255;
        img.data[i * 4 + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        img.data[i * 4 + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
