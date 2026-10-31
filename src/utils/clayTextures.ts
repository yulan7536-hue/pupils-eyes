import * as THREE from 'three';

/**
 * 纯代码生成的黏土贴图。
 * 1) 地球底色：把简化大陆画进等距圆柱投影，再压上揉泥与纸浆颗粒；大陆边缘留一圈"捏出来"的浅边。
 * 2) 法线：低频噪声起伏，模拟手指按压的软陶表面。
 * 色调全部落在莫兰迪区间（灰绿海、灰苔陆地、浅土黄高地）。
 */

const OCEAN = '#63a6d2';
const OCEAN_DEEP = '#5194c4';
const LAND = '#6cae4d';
const LAND_DEEP = '#569140';
const LAND_LIT = '#86c165';
const OCHRE = '#cbb073';
const ICE = '#eff2e4';

/** 经纬度 → 等距圆柱像素 */
const px = (lon: number, w: number) => ((lon + 180) / 360) * w;
const py = (lat: number, h: number) => ((90 - lat) / 180) * h;

type Poly = [number, number][];

const CONTINENTS: { pts: Poly; color: string }[] = [
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
    pts: [
      [74, 38], [86, 40], [100, 38], [102, 30], [94, 26], [80, 28], [74, 32],
    ],
  },
  {
    // 撒哈拉
    color: OCHRE,
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

export function createClayEarthTexture(width = 2048, height = 1024): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 海：两块蓝揉在一起
    ctx.fillStyle = OCEAN;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = OCEAN_DEEP;
    for (let i = 0; i < 22; i++) {
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * width,
        Math.random() * height,
        90 + Math.random() * 260,
        60 + Math.random() * 170,
        Math.random() * Math.PI,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // 极冰：北极直接盖，南极用垂直渐变随球面渐隐，避免在球底形成硬边椭圆污渍
    ctx.fillStyle = ICE;
    ctx.fillRect(0, 0, width, py(82, height));

    const southTop = py(-64, height); // 渐变起点（较北、更靠近赤道）
    const southBottom = height; // 球底
    const southGrad = ctx.createLinearGradient(0, southTop, 0, southBottom);
    southGrad.addColorStop(0, 'rgba(239, 242, 228, 0)');
    southGrad.addColorStop(0.35, 'rgba(239, 242, 228, 0.55)');
    southGrad.addColorStop(1, 'rgba(239, 242, 228, 0.95)');
    ctx.fillStyle = southGrad;
    ctx.fillRect(0, southTop, width, southBottom - southTop);

    // 大陆：先描一圈浅色"捏边"，再压上本体的泥色
    CONTINENTS.forEach(({ pts, color }) => {
      ctx.save();
      ctx.translate(5, 6);
      polyPath(ctx, pts, width, height);
      ctx.fillStyle = 'rgba(58, 82, 52, 0.4)';
      ctx.fill();
      ctx.restore();

      polyPath(ctx, pts, width, height);
      ctx.fillStyle = color;
      ctx.fill();

      // 泥块内部的明暗：压一块受光的泥、再压一块背光的泥
      ctx.save();
      polyPath(ctx, pts, width, height);
      ctx.clip();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = LAND_LIT;
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
      ctx.beginPath();
      ctx.ellipse(cx - rw * 0.28, cy - rh * 0.34, rw * 0.8, rh * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = LAND_DEEP;
      ctx.beginPath();
      ctx.ellipse(cx + rw * 0.34, cy + rh * 0.42, rw * 0.9, rh * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 揉泥条纹：极淡，只留一点被抹过的痕迹
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(232, 240, 226, 0.045)' : 'rgba(84, 104, 86, 0.045)';
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * width,
        Math.random() * height,
        20 + Math.random() * 70,
        8 + Math.random() * 22,
        Math.random() * Math.PI,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // 纸浆颗粒
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    for (let i = 0; i < 2600; i++) {
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }
    ctx.fillStyle = 'rgba(70, 84, 70, 0.1)';
    for (let i = 0; i < 1800; i++) {
      ctx.fillRect(Math.random() * width, Math.random() * height, 2.4, 2.4);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
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
