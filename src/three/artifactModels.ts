/**
 * 三座古建的程序化精细模型
 *
 * 设计取舍：
 * - 不用外部 glb —— 全部由基础几何现场生成，构建体积不增加，也便于按文物换色。
 * - 保留三渲二质感（MeshToonMaterial + 深色逆面描边），与页面其余部分的绘本风统一，
 *   但每个模型都拆出 3~4 个明度层次（亮/主/暗/点缀），不再是单一色块。
 * - 严格控制面数：重复构件（栏杆、斗拱、拱券石）复用同一份 geometry，
 *   只做实例摆放，避免每个小件都重新分配显存。
 */

import * as THREE from 'three';

const OUTLINE_COLOR = 0x161a20;

export type ArtifactKey = 'pavilion' | 'arch' | 'opera';

interface Palette {
  /** 受光面 */
  light: THREE.MeshToonMaterial;
  /** 主体色 */
  base: THREE.MeshToonMaterial;
  /** 背光面 / 阴影结构 */
  dark: THREE.MeshToonMaterial;
  /** 点缀色（灯、藤叶、玻璃） */
  accent: THREE.MeshToonMaterial;
}

function makePalette(base: number, accentColor?: number): Palette {
  const c = new THREE.Color(base);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const shift = (dl: number, ds = 0) =>
    new THREE.Color().setHSL(hsl.h, Math.min(1, Math.max(0, hsl.s + ds)), Math.max(0, Math.min(1, hsl.l + dl)));
  return {
    light: new THREE.MeshToonMaterial({ color: shift(0.1) }),
    base: new THREE.MeshToonMaterial({ color: c.clone() }),
    dark: new THREE.MeshToonMaterial({ color: shift(-0.16, 0.03) }),
    accent: new THREE.MeshToonMaterial({ color: accentColor ?? shift(-0.3, 0.1) }),
  };
}

/** 逆面描边：同一份 geometry 放大一点点、法线翻到背面画深色，得到手绘轮廓线 */
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });

type PartOpts = {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  /** 描边放大系数，不给则不描边（小构件描边会糊成一团） */
  outline?: number;
  /** 材质改用背面，用于薄壳结构 */
  doubleSide?: boolean;
};

class Builder {
  readonly group = new THREE.Group();

  add(geo: THREE.BufferGeometry, mat: THREE.Material, o: PartOpts = {}) {
    const m = new THREE.Mesh(geo, mat);
    if (o.pos) m.position.set(...o.pos);
    if (o.rot) m.rotation.set(...o.rot);
    if (o.scale) m.scale.set(...o.scale);
    this.group.add(m);

    if (o.outline) {
      const ol = new THREE.Mesh(geo, OUTLINE_MAT);
      ol.position.copy(m.position);
      ol.rotation.copy(m.rotation);
      ol.scale.copy(m.scale).multiplyScalar(o.outline);
      this.group.add(ol);
    }
    return m;
  }

  /** 沿一组点画一条管，用来做藤蔓、翘角、屋脊这类曲线构件 */
  tube(points: [number, number, number][], radius: number, mat: THREE.Material, seg = 34) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return this.add(new THREE.TubeGeometry(curve, seg, radius, 6, false), mat);
  }
}

/* ============================================================
   一、中式开放水榭凉亭
   台基 → 柱础 → 檐柱 → 额枋挂落 → 斗拱 → 飞檐（翘角＋屋脊）→ 宝顶
   ============================================================ */
function buildPavilion(color: number) {
  const b = new Builder();
  const p = makePalette(color, 0xffca6e);

  // —— 台基：三层收分 + 正面临水踏步
  b.add(new THREE.BoxGeometry(2.64, 0.16, 2.64), p.dark, { pos: [0, -1.42, 0], outline: 1.02 });
  b.add(new THREE.BoxGeometry(2.36, 0.14, 2.36), p.base, { pos: [0, -1.27, 0] });
  b.add(new THREE.BoxGeometry(2.12, 0.1, 2.12), p.light, { pos: [0, -1.15, 0] });
  for (let i = 0; i < 2; i++) {
    b.add(new THREE.BoxGeometry(1.15 - i * 0.16, 0.08, 0.26), p.dark, {
      pos: [0, -1.36 + i * 0.1, 1.34 - i * 0.12],
    });
  }
  // 台面木地板缝：两条浅色细板，暗示铺装
  for (const z of [-0.55, 0.55]) {
    b.add(new THREE.BoxGeometry(2.02, 0.012, 0.02), p.dark, { pos: [0, -1.088, z] });
  }

  // —— 四根檐柱：柱础 + 柱身 + 柱头托
  const COL_XZ = 0.92;
  const COL_BOTTOM = -1.09;
  const COL_H = 1.62;
  const shaft = new THREE.CylinderGeometry(0.072, 0.086, COL_H, 12);
  const foot = new THREE.CylinderGeometry(0.128, 0.148, 0.1, 8);
  const cap = new THREE.BoxGeometry(0.2, 0.055, 0.2);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * COL_XZ;
      const z = sz * COL_XZ;
      b.add(foot, p.dark, { pos: [x, COL_BOTTOM + 0.02, z] });
      b.add(shaft, p.base, { pos: [x, COL_BOTTOM + COL_H / 2, z], outline: 1.06 });
      b.add(cap, p.dark, { pos: [x, COL_BOTTOM + COL_H + 0.02, z] });
    }
  }

  // —— 额枋（四边联系梁）＋ 挂落（梁下垂花）
  const BEAM_Y = COL_BOTTOM + COL_H + 0.11;
  const beamLong = new THREE.BoxGeometry(2.02, 0.11, 0.1);
  const beamSide = new THREE.BoxGeometry(0.1, 0.11, 2.02);
  for (const z of [-COL_XZ, COL_XZ]) b.add(beamLong, p.dark, { pos: [0, BEAM_Y, z] });
  for (const x of [-COL_XZ, COL_XZ]) b.add(beamSide, p.dark, { pos: [x, BEAM_Y, 0] });
  // 挂落：梁下一排小竖棂，让檐下不再是一片空
  const fret = new THREE.BoxGeometry(0.028, 0.13, 0.028);
  for (let i = -4; i <= 4; i++) {
    for (const z of [-COL_XZ, COL_XZ]) b.add(fret, p.accent, { pos: [i * 0.2, BEAM_Y - 0.12, z] });
  }

  // —— 斗拱：角科四攒 + 平身科四攒，每攒「斗」＋「拱」两件
  const dou = new THREE.BoxGeometry(0.15, 0.09, 0.15);
  const gong = new THREE.BoxGeometry(0.3, 0.05, 0.09);
  const DOUGONG: [number, number][] = [
    [-COL_XZ, -COL_XZ], [COL_XZ, -COL_XZ], [-COL_XZ, COL_XZ], [COL_XZ, COL_XZ],
    [0, -COL_XZ], [0, COL_XZ], [-COL_XZ, 0], [COL_XZ, 0],
  ];
  for (const [x, z] of DOUGONG) {
    b.add(dou, p.dark, { pos: [x, BEAM_Y + 0.1, z] });
    b.add(gong, p.base, { pos: [x, BEAM_Y + 0.17, z], rot: [0, Math.abs(x) > Math.abs(z) ? Math.PI / 2 : 0, 0] });
    b.add(gong, p.base, { pos: [x, BEAM_Y + 0.22, z], rot: [0, Math.abs(x) > Math.abs(z) ? 0 : Math.PI / 2, 0] });
  }

  // —— 屋顶：四角攒尖 + 檐板 + 四条翘角 + 四条垂脊 + 宝顶
  const ROOF_BOTTOM = BEAM_Y + 0.26;
  const ROOF_H = 1.02;
  const roof = b.add(new THREE.ConeGeometry(1.76, ROOF_H, 4), p.base, {
    pos: [0, ROOF_BOTTOM + ROOF_H / 2, 0],
    rot: [0, Math.PI / 4, 0],
    outline: 1.025,
  });
  // 檐口一圈薄板，把锥体与柱子收口
  b.add(new THREE.CylinderGeometry(1.7, 1.78, 0.075, 4), p.dark, {
    pos: [0, ROOF_BOTTOM + 0.01, 0],
    rot: [0, Math.PI / 4, 0],
  });
  // 瓦口：檐板贴脸的一圈方形瓦头。
  // 四角攒尖顶旋转 45° 后，檐板四个平面分别在 x=±1.24 / z=±1.24 上，
  // 所以瓦头必须贴着这几个平面摆，之前按 z=1.5 做 V 形铺开，全都飘到檐口外面去了。
  const tileGeo = new THREE.BoxGeometry(0.055, 0.06, 0.03);
  const TILE_PLANE = 1.235;
  for (let i = -4; i <= 4; i++) {
    const t = i * 0.24;
    b.add(tileGeo, p.accent, { pos: [t, ROOF_BOTTOM + 0.02, TILE_PLANE] });
    b.add(tileGeo, p.accent, { pos: [t, ROOF_BOTTOM + 0.02, -TILE_PLANE] });
    b.add(tileGeo, p.accent, { pos: [TILE_PLANE, ROOF_BOTTOM + 0.02, t], rot: [0, Math.PI / 2, 0] });
    b.add(tileGeo, p.accent, { pos: [-TILE_PLANE, ROOF_BOTTOM + 0.02, t], rot: [0, Math.PI / 2, 0] });
  }

  // 瓦垄：四个坡面各铺一排细脊，从宝顶放射到檐口。
  // 远景靠翘角定型，近景全靠这层细脊撑质感 —— 没有它，攒尖顶就是一块光板。
  const TILE_ROWS = 5;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    // 坡面内沿：沿檐口方向（垂直 n）铺开
    const px = -Math.sin(a);
    const pz = Math.cos(a);
    for (let i = 0; i < TILE_ROWS; i++) {
      const o = (i - (TILE_ROWS - 1) / 2) * 0.33;
      b.tube(
        [
          [nx * 0.12, ROOF_BOTTOM + ROOF_H - 0.02, nz * 0.12],
          [nx * 0.7 + px * o * 0.55, ROOF_BOTTOM + ROOF_H * 0.42, nz * 0.7 + pz * o * 0.55],
          [nx * 1.18 + px * o, ROOF_BOTTOM + 0.03, nz * 1.18 + pz * o],
        ],
        0.013,
        p.dark,
        10
      );
    }
  }

  // 四条翘角：从檐角外挑并向上起翘，这是"飞檐"最关键的剪影
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * 1.24;
      const cz = sz * 1.24;
      b.tube(
        [
          [cx * 0.99, ROOF_BOTTOM + 0.01, cz * 0.99],
          [cx * 1.09, ROOF_BOTTOM + 0.03, cz * 1.09],
          [cx * 1.08, ROOF_BOTTOM + 0.13, cz * 1.08],
          [cx * 1.09, ROOF_BOTTOM + 0.3, cz * 1.09],
        ],
        0.05,
        p.dark,
        18
      );
      // 角科套兽：翘角尽头一枚收头，用小球而不是尖锥，避免像插了根箭头
      b.add(new THREE.SphereGeometry(0.042, 8, 6), p.accent, {
        pos: [cx * 1.09, ROOF_BOTTOM + 0.32, cz * 1.09],
      });
      // 垂脊：起点宝顶、终点檐角，中间点按直线插值取，
      // 之前用固定系数 0.55/0.48 落在棱线外侧，脊就鼓出屋面浮在空中。
      const APEX: [number, number, number] = [0, ROOF_BOTTOM + ROOF_H - 0.05, 0];
      const CORNER: [number, number, number] = [cx * 0.98, ROOF_BOTTOM + 0.03, cz * 0.98];
      const lerp = (t: number): [number, number, number] => [
        APEX[0] + (CORNER[0] - APEX[0]) * t,
        APEX[1] + (CORNER[1] - APEX[1]) * t,
        APEX[2] + (CORNER[2] - APEX[2]) * t,
      ];
      b.tube([lerp(0), lerp(0.34), lerp(0.68), lerp(1)], 0.028, p.dark, 20);
    }
  }
  // 宝顶：座 + 珠
  b.add(new THREE.CylinderGeometry(0.1, 0.14, 0.12, 8), p.dark, { pos: [0, ROOF_BOTTOM + ROOF_H + 0.02, 0] });
  b.add(new THREE.SphereGeometry(0.11, 12, 10), p.accent, {
    pos: [0, ROOF_BOTTOM + ROOF_H + 0.16, 0],
    outline: 1.08,
  });

  // —— 美人靠：后檐与两侧设栏杆（正面敞开，才能"看出去"）
  const RAIL_Y = -0.42;
  const RAIL_TOP = -0.02;
  const railGeo = new THREE.BoxGeometry(1.94, 0.06, 0.06);
  const railGeoZ = new THREE.BoxGeometry(0.06, 0.06, 1.94);
  // 立柱高度 = 上下两道横杆的间距；减反了会得到 0 高度，立柱整排消失
  const post = new THREE.CylinderGeometry(0.026, 0.026, RAIL_TOP - RAIL_Y, 6);
  // 后侧
  b.add(railGeo, p.dark, { pos: [0, RAIL_TOP, -COL_XZ] });
  b.add(railGeo, p.dark, { pos: [0, RAIL_Y, -COL_XZ] });
  for (let i = -3; i <= 3; i++) {
    b.add(post, p.base, { pos: [i * 0.28, (RAIL_TOP + RAIL_Y) / 2, -COL_XZ] });
  }
  // 左右两侧
  for (const x of [-COL_XZ, COL_XZ]) {
    b.add(railGeoZ, p.dark, { pos: [x, RAIL_TOP, 0] });
    b.add(railGeoZ, p.dark, { pos: [x, RAIL_Y, 0] });
    for (let i = -3; i <= 3; i++) {
      b.add(post, p.base, { pos: [x, (RAIL_TOP + RAIL_Y) / 2, i * 0.28] });
    }
  }

  // —— 八角宫灯：梁下垂两盏，是"夜幕暖光"的点睛
  for (const x of [-0.42, 0.42]) {
    b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), p.dark, { pos: [x, BEAM_Y - 0.22, 0] });
    b.add(new THREE.CylinderGeometry(0.072, 0.072, 0.085, 8), p.accent, { pos: [x, BEAM_Y - 0.35, 0] });
    b.add(new THREE.SphereGeometry(0.115, 10, 8), p.accent, {
      pos: [x, BEAM_Y - 0.45, 0],
      scale: [1, 0.85, 1],
    });
    b.add(new THREE.ConeGeometry(0.05, 0.065, 8), p.dark, { pos: [x, BEAM_Y - 0.56, 0], rot: [Math.PI, 0, 0] });
  }

  return b.group;
}

/* ============================================================
   二、古罗马科林斯柱式拱门
   台阶 → 柱础 → 凹槽柱身 → 科林斯柱头（涡卷）→ 分段拱券石 → 拱心石 → 檐部
   ============================================================ */
function buildArch(color: number) {
  const b = new Builder();
  const p = makePalette(color, 0xbfb8a8);
  // 藤蔓单独一份材质：点缀色槽留给石材细节，绿色只给叶子用
  const ivyMat = new THREE.MeshToonMaterial({ color: 0x4f7a3f });

  // —— 三级台阶 + 台座
  for (let i = 0; i < 3; i++) {
    b.add(new THREE.BoxGeometry(3.5 - i * 0.16, 0.11, 1.5 - i * 0.05), i === 0 ? p.dark : p.base, {
      pos: [0, -1.78 + i * 0.11, 0.2],
    });
  }
  b.add(new THREE.BoxGeometry(3.0, 0.16, 1.15), p.base, { pos: [0, -1.38, 0], outline: 1.015 });

  // —— 两根柱：柱础 → 凹槽柱身 → 柱头
  const PAL = 1.02;
  const COL_BOTTOM = -1.3;
  const COL_H = 1.86;
  // 平面着色：20 段棱面自身就读作凹槽（fluting），比真挖 20 条槽省一个数量级的面数。
  // three 0.187 的 MeshToonMaterial 没有 flatShading 开关，改为拆成非索引几何后
  // 重算法线 —— 每个三角面各用一份法线，得到同样的小平面效果。
  const shaftGeo = new THREE.CylinderGeometry(0.185, 0.215, COL_H, 20).toNonIndexed();
  shaftGeo.computeVertexNormals();
  const shaftMat = new THREE.MeshToonMaterial({ color: p.base.color });
  for (const sx of [-1, 1]) {
    const x = sx * PAL;
    // 柱础：方形垫石 + 圆盘 + 收分环
    b.add(new THREE.BoxGeometry(0.56, 0.1, 0.56), p.dark, { pos: [x, COL_BOTTOM + 0.05, 0] });
    b.add(new THREE.CylinderGeometry(0.28, 0.3, 0.08, 12), p.light, { pos: [x, COL_BOTTOM + 0.13, 0] });
    b.add(new THREE.TorusGeometry(0.215, 0.022, 6, 18), p.light, {
      pos: [x, COL_BOTTOM + 0.19, 0],
      rot: [Math.PI / 2, 0, 0],
    });
    // 柱身：20 段且平面着色，棱面本身就读作凹槽（fluting），不必再挖真槽
    b.add(shaftGeo, shaftMat, { pos: [x, COL_BOTTOM + COL_H / 2 + 0.14, 0], outline: 1.05 });
    // 柱身中段两道箍环，打断长直的圆柱
    for (const t of [0.42, 0.72]) {
      b.add(new THREE.TorusGeometry(0.196, 0.014, 6, 18), p.light, {
        pos: [x, COL_BOTTOM + COL_H * t, 0],
        rot: [Math.PI / 2, 0, 0],
      });
    }

    // 柱头：钟形圆盘（echinus）+ 侧向涡卷（volute）+ 顶板（abacus）
    const capY = COL_BOTTOM + COL_H + 0.16;
    b.add(new THREE.CylinderGeometry(0.24, 0.2, 0.1, 14), p.light, { pos: [x, capY, 0] });
    b.add(new THREE.CylinderGeometry(0.29, 0.24, 0.07, 14), p.base, { pos: [x, capY + 0.09, 0] });
    b.add(new THREE.BoxGeometry(0.62, 0.09, 0.62), p.light, { pos: [x, capY + 0.17, 0], outline: 1.03 });
    for (const sz of [-1, 1]) {
      b.add(new THREE.TorusGeometry(0.082, 0.026, 6, 14, Math.PI * 1.75), p.dark, {
        pos: [x, capY + 0.06, sz * 0.235],
        rot: [0, sz > 0 ? 0 : Math.PI, 0.4],
      });
    }
    // 柱头叶饰：四片小锥，暗示茛苕叶
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      b.add(new THREE.ConeGeometry(0.055, 0.16, 4), p.dark, {
        pos: [x + Math.cos(a) * 0.235, capY - 0.02, Math.sin(a) * 0.235],
        rot: [0, -a, 0.25],
      });
    }
  }

  // —— 拱券：半圆环本体 + 一圈分段券石 + 拱心石
  const ARCH_Y = COL_BOTTOM + COL_H + 0.32;
  b.add(new THREE.TorusGeometry(PAL, 0.17, 8, 30, Math.PI), p.base, {
    pos: [0, ARCH_Y, 0],
    outline: 1.02,
  });
  // 分段券石（voussoir）：9 块楔形石沿弧排布，让拱背有砌筑感
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = (Math.PI * (i + 0.5)) / N;
    const isKey = i === (N - 1) / 2;
    b.add(
      new THREE.BoxGeometry(isKey ? 0.3 : 0.26, 0.3, isKey ? 0.44 : 0.38),
      isKey ? p.light : p.base,
      {
        pos: [Math.cos(a) * PAL, ARCH_Y + Math.sin(a) * PAL, 0],
        rot: [0, 0, a - Math.PI / 2],
      }
    );
  }
  // 拱肩不再塞方块：之前那两块 0.34×0.6 的实心柱墩立在起拱点上，
  // 既不像墙也不像柱，近看就是两块积木。起拱点留空，由券石自带的
  // 收头交代过去，反而更接近真实石拱的剖面关系。

  // —— 檐部：额枋 + 齿饰 + 挑檐
  const ENT_Y = ARCH_Y + PAL + 0.2;
  b.add(new THREE.BoxGeometry(3.06, 0.14, 0.64), p.base, { pos: [0, ENT_Y, 0], outline: 1.015 });
  b.add(new THREE.BoxGeometry(3.14, 0.1, 0.72), p.light, { pos: [0, ENT_Y + 0.12, 0] });
  for (let i = -7; i <= 7; i++) {
    b.add(new THREE.BoxGeometry(0.09, 0.07, 0.1), p.dark, { pos: [i * 0.2, ENT_Y + 0.2, 0.33] });
  }
  b.add(new THREE.BoxGeometry(3.24, 0.07, 0.82), p.dark, { pos: [0, ENT_Y + 0.27, 0] });

  // —— 常春藤：沿左柱攀爬，末梢垂到拱肩
  const ivY = (t: number) => -1.28 + t * 2.6;
  b.tube(
    [
      [-1.08, ivY(0.1), 0.16],
      [-1.14, ivY(0.26), 0.24],
      [-1.05, ivY(0.42), 0.3],
      [-1.16, ivY(0.58), 0.26],
      [-1.06, ivY(0.74), 0.2],
    ],
    0.017,
    ivyMat,
    40
  );
  const leaf = new THREE.SphereGeometry(0.05, 6, 4);
  const LEAVES: [number, number, number][] = [
    [-1.12, ivY(0.18), 0.24],
    [-1.05, ivY(0.3), 0.3],
    [-1.15, ivY(0.4), 0.25],
    [-1.03, ivY(0.5), 0.28],
    [-1.14, ivY(0.62), 0.27],
    [-1.02, ivY(0.72), 0.23],
    [-1.1, ivY(0.84), 0.22],
  ];
  for (const [x, y, z] of LEAVES) {
    b.add(leaf, ivyMat, { pos: [x, y, z], scale: [1.25, 0.55, 1] });
  }

  return b.group;
}

/* ============================================================
   三、悉尼歌剧院帆影薄壳
   基座台阶 → 玻璃门厅 → 三组双曲薄壳（球面截段，不是圆锥）
   ============================================================ */
function buildOpera(color: number) {
  const b = new Builder();
  const p = makePalette(color, 0x2f3a45);

  // —— 基座：海岬平台 + 三级台阶
  b.add(new THREE.BoxGeometry(3.4, 0.14, 1.9), p.dark, { pos: [0, -1.06, 0], outline: 1.012 });
  b.add(new THREE.BoxGeometry(3.1, 0.12, 1.66), p.base, { pos: [0, -0.93, 0] });
  for (let i = 0; i < 3; i++) {
    b.add(new THREE.BoxGeometry(2.5 - i * 0.18, 0.075, 0.26), i === 2 ? p.light : p.base, {
      pos: [0, -1.0 + i * 0.075, 1.02 - i * 0.1],
    });
  }

  // —— 玻璃门厅：偏冷的浅蓝玻璃 + 稀疏竖梃。
  // 之前用深墨色盒子配 13 根竖梃，整排看过去像一道铁栅栏，把它的"玻璃"属性盖掉了。
  const glassMat = new THREE.MeshToonMaterial({
    color: 0x6d8ba3,
    transparent: true,
    opacity: 0.72,
  });
  b.add(new THREE.BoxGeometry(2.55, 0.5, 1.1), glassMat, { pos: [0, -0.62, 0.02] });
  b.add(new THREE.BoxGeometry(2.62, 0.045, 1.16), p.light, { pos: [0, -0.37, 0.02] });
  for (let i = -4; i <= 4; i++) {
    b.add(new THREE.BoxGeometry(0.03, 0.5, 0.03), p.light, { pos: [i * 0.3, -0.62, 0.57] });
  }

  /**
   * 单片薄壳：取球面的一段（phi/theta 双向截取），再把 z 轴压扁，
   * 得到"单向曲率陡、另一向平缓"的双曲壳 —— 这正是歌剧院屋面的几何特征。
   * 用圆锥去凑会得到直纹锥面，侧面轮廓是直线，一眼假。
   */
  const shell = (r: number, phiLen: number, thetaLen: number, squash: number) => {
    // thetaLen 决定壳脚落在哪：截到接近 90° 时壳的下缘正好落在球心高度，
    // 球心放在基座面就能让壳"长"在基座上；之前只切到 1.34rad，壳脚悬在半空。
    const g = new THREE.SphereGeometry(r, 30, 20, -phiLen / 2, phiLen, 0.05, thetaLen);
    g.scale(1, 1, squash);
    return g;
  };
  const shellMat = new THREE.MeshToonMaterial({ color: p.base.color, side: THREE.DoubleSide });
  const shellMatShade = new THREE.MeshToonMaterial({ color: p.dark.color, side: THREE.DoubleSide });

  /**
   * 一组 = 两片对开的壳，在中缝处收成一道脊。
   * 单壳体无论怎么调都像一张立起来的纸片；歌剧院真正的形态是
   * 两片壳体向两侧张开、共一条脊线，正面看是个"V"，侧面才是帆。
   */
  const group = (x: number, z: number, scale: number, mat: THREE.Material) => {
    for (const sgn of [-1, 1]) {
      b.add(shell(1.24, 1.3, 1.52, 0.72), mat, {
        pos: [x, -0.86, z],
        rot: [0.04, sgn * 0.42, 0],
        scale: [scale * 0.92, scale, scale * 0.8],
        outline: 1.008,
      });
    }
    // 中缝收脊：一道窄脊盖住两片壳的接缝，避免中间露出锯齿状交界
    b.add(new THREE.BoxGeometry(0.03, 0.055, 1.5 * scale), p.dark, {
      pos: [x, -0.1 * scale + 0.02, z + 0.06 * scale],
      rot: [-0.32, 0, 0],
    });
  };

  // 三组壳：中组最高、左右递次，高度差形成错落的"风帆"
  group(-0.74, -0.06, 0.88, shellMatShade);
  group(0.06, -0.12, 1.06, shellMat);
  group(0.82, -0.04, 0.84, shellMatShade);

  // 壳顶原来沿对称面补了一道"骨线"，但壳是球面截段压扁来的，
  // 直线插值出来的管会从壳面切出去，远看就是三根天线。改为不加，
  // 靠壳本身的明暗交界与描边交代曲面转折。

  return b.group;
}

/* ============================================================
   装配：模型 + 接触阴影 + 三点光照
   ============================================================ */

function contactShadow(radius: number) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.46)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const mat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(radius * 3, radius * 3), mat);
  plane.rotation.x = -Math.PI / 2;
  return plane;
}

export interface ArtifactModel {
  group: THREE.Group;
  /** 接触阴影，需单独加到场景（不随模型自转） */
  shadow: THREE.Mesh;
  /** 用于相机自适应取景的外接球半径 */
  radius: number;
}

export function buildArtifact(key: ArtifactKey, color: number): ArtifactModel {
  const raw =
    key === 'pavilion' ? buildPavilion(color) : key === 'opera' ? buildOpera(color) : buildArch(color);

  // 统一居中：各模型自身坐标系高度不一，居中后相机参数才能共用一套
  const box = new THREE.Box3().setFromObject(raw);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  raw.position.sub(center);

  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  const shadow = contactShadow(radius);
  shadow.position.y = box.min.y - center.y + 0.02;

  return { group: raw, shadow, radius };
}

/** 三点光照：暖色主光 + 冷色补光 + 背后的轮廓光，让暗面不至于死黑 */
export function buildLightRig() {
  const rig = new THREE.Group();

  rig.add(new THREE.AmbientLight(0xfff2df, 0.62));

  const key = new THREE.DirectionalLight(0xffe1b4, 2.0);
  key.position.set(4.5, 7, 5);
  rig.add(key);

  const fill = new THREE.DirectionalLight(0x9dc4e8, 0.85);
  fill.position.set(-6, 2.4, 3.2);
  rig.add(fill);

  const rim = new THREE.DirectionalLight(0xfff6e6, 1.15);
  rim.position.set(-1.5, 3.2, -6.5);
  rig.add(rim);

  return rig;
}
