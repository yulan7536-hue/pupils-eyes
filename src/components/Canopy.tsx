/**
 * 树冠：横跨画面顶部的一道深绿黏土拱廊。
 * 用一叠重叠的圆形团块union成有机的冠形，每块自带球面明暗，
 * 所以整片读起来是一团被捏出来的黏土，而不是一堆贴纸。
 * 纯装饰（aria-hidden），不吃鼠标事件。
 */

type Blob = {
  /** 水平位置，视口宽度百分比 */
  x: number;
  /** 圆心高度，vmin（负值＝探出画面外） */
  y: number;
  /** 直径，vmin */
  d: number;
  /** 球面高光朝向，百分比坐标 */
  hx: number;
  hy: number;
  /** 色调：0 深（背光） 1 中 2 亮（受光） */
  tone: 0 | 1 | 2;
};

const BLOBS: Blob[] = [
  // —— 左角主冠：从左上角垂下来的一团 ——
  { x: -2, y: -4, d: 38, hx: 40, hy: 28, tone: 1 },
  { x: 8, y: -7, d: 44, hx: 44, hy: 26, tone: 2 },
  { x: 18, y: -1, d: 36, hx: 42, hy: 30, tone: 1 },
  { x: 0, y: 15, d: 28, hx: 46, hy: 32, tone: 0 },
  { x: 11, y: 18, d: 26, hx: 44, hy: 34, tone: 0 },
  { x: 23, y: 12, d: 24, hx: 42, hy: 32, tone: 1 },
  { x: 29, y: 3, d: 19, hx: 40, hy: 30, tone: 0 },

  // —— 顶部中段：一道薄薄的拱 ——
  { x: 36, y: -3, d: 26, hx: 42, hy: 28, tone: 1 },
  { x: 45, y: -5, d: 29, hx: 44, hy: 26, tone: 2 },
  { x: 54, y: -4, d: 28, hx: 42, hy: 30, tone: 1 },
  { x: 63, y: -3, d: 26, hx: 44, hy: 28, tone: 2 },
  { x: 72, y: 0, d: 24, hx: 42, hy: 32, tone: 1 },

  // —— 右角主冠 ——
  { x: 78, y: 2, d: 23, hx: 40, hy: 30, tone: 1 },
  { x: 87, y: -4, d: 40, hx: 42, hy: 28, tone: 2 },
  { x: 97, y: -1, d: 37, hx: 40, hy: 26, tone: 1 },
  { x: 102, y: 16, d: 28, hx: 46, hy: 32, tone: 0 },
  { x: 92, y: 19, d: 26, hx: 44, hy: 34, tone: 0 },
  { x: 82, y: 12, d: 22, hx: 42, hy: 32, tone: 1 },
];

/** 冠沿上撒的多瓣小花：奶油白 / 奶黄 / 浅樱花粉 / 淡雾蓝，贴着冠的下缘长 */
const FLOWERS: { x: number; y: number; s: number; c: 'cream' | 'pink' | 'blue' | 'yellow' }[] = [
  { x: 3, y: 26, s: 1, c: 'pink' },
  { x: 10, y: 30, s: 1.15, c: 'cream' },
  { x: 18, y: 25, s: 0.9, c: 'blue' },
  { x: 26, y: 17, s: 1, c: 'yellow' },
  { x: 33, y: 9, s: 0.8, c: 'pink' },
  { x: 41, y: 4, s: 0.9, c: 'cream' },
  { x: 50, y: 3, s: 0.85, c: 'blue' },
  { x: 59, y: 5, s: 0.95, c: 'yellow' },
  { x: 67, y: 8, s: 0.8, c: 'pink' },
  { x: 75, y: 14, s: 1, c: 'cream' },
  { x: 84, y: 23, s: 1.15, c: 'blue' },
  { x: 92, y: 27, s: 0.9, c: 'pink' },
  { x: 98, y: 19, s: 0.85, c: 'cream' },
  { x: 7, y: 22, s: 0.75, c: 'yellow' },
  { x: 15, y: 28, s: 0.7, c: 'blue' },
  { x: 36, y: 6, s: 0.7, c: 'cream' },
  { x: 47, y: 1, s: 0.72, c: 'pink' },
  { x: 71, y: 11, s: 0.7, c: 'blue' },
  { x: 88, y: 18, s: 0.72, c: 'yellow' },
  { x: 96, y: 23, s: 0.7, c: 'pink' },
];

/** 冠沿上的小黄花苞 */
const BUDS = [
  { x: 6, y: 19, s: 0.7 },
  { x: 21, y: 20, s: 0.6 },
  { x: 37, y: 1, s: 0.55 },
  { x: 55, y: -2, s: 0.6 },
  { x: 70, y: 2, s: 0.55 },
  { x: 88, y: 15, s: 0.7 },
];

/** 冠沿上探出来的叶片：圆形团块靠它才读成"树叶"而不是"泡泡" */
const LEAVES = [
  { x: 1, y: 27, r: -18, s: 1.1, tone: 0 },
  { x: 5, y: 31, r: 16, s: 0.9, tone: 1 },
  { x: 9, y: 24, r: -34, s: 1.15, tone: 1 },
  { x: 13, y: 30, r: 22, s: 0.85, tone: 0 },
  { x: 17, y: 26, r: -8, s: 1, tone: 1 },
  { x: 21, y: 21, r: 30, s: 0.9, tone: 0 },
  { x: 25, y: 15, r: -24, s: 1.05, tone: 1 },
  { x: 29, y: 10, r: 12, s: 0.8, tone: 0 },
  { x: 33, y: 9, r: -16, s: 0.95, tone: 1 },
  { x: 38, y: 8, r: 26, s: 0.85, tone: 1 },
  { x: 43, y: 7, r: -10, s: 0.9, tone: 0 },
  { x: 48, y: 7, r: 18, s: 0.85, tone: 1 },
  { x: 53, y: 8, r: -28, s: 0.95, tone: 1 },
  { x: 58, y: 9, r: 8, s: 0.8, tone: 0 },
  { x: 63, y: 11, r: -22, s: 0.9, tone: 1 },
  { x: 68, y: 13, r: 20, s: 0.85, tone: 1 },
  { x: 73, y: 15, r: -12, s: 1, tone: 0 },
  { x: 77, y: 16, r: 28, s: 0.9, tone: 1 },
  { x: 81, y: 21, r: -26, s: 1.05, tone: 1 },
  { x: 85, y: 25, r: 14, s: 0.85, tone: 0 },
  { x: 89, y: 28, r: -20, s: 1.1, tone: 1 },
  { x: 93, y: 24, r: 24, s: 0.9, tone: 0 },
  { x: 97, y: 20, r: -6, s: 1, tone: 1 },
  { x: 100, y: 14, r: 32, s: 0.85, tone: 0 },
];

const LEAF_FILL = ['#7fc05c', '#8fcd69', '#a5dd7e'] as const;

const TONE_FILL = ['#7fc05c', '#8fcd69', '#a5dd7e'] as const;

function Flower({ s, c = 'cream' }: { s: number; c?: 'cream' | 'pink' | 'blue' | 'yellow' }) {
  const petal =
    c === 'pink' ? '#f7cdd2' : c === 'blue' ? '#cfe0f2' : c === 'yellow' ? '#f7e6a8' : '#f7f2d9';
  const center = c === 'yellow' ? '#e8c05a' : '#ecc96b';
  return (
    <svg viewBox="-14 -14 28 28" style={{ width: `calc(${s} * 2.6vmin)`, height: `calc(${s} * 2.6vmin)` }}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx="0"
          cy="-6.6"
          rx="4.6"
          ry="6.4"
          fill={petal}
          transform={`rotate(${deg})`}
        />
      ))}
      <circle r="3.4" fill={center} />
      <circle r="3.4" cx="-0.8" cy="-0.9" fill="#fff6d6" opacity="0.85" />
    </svg>
  );
}

export default function Canopy() {
  return (
    <div className="canopy" aria-hidden="true">
      {BLOBS.map((b, i) => (
        <span
          key={i}
          className="canopy__blob"
          style={{
            left: `${b.x}%`,
            top: `calc(${b.y}vmin - ${b.d / 2}vmin)`,
            width: `${b.d}vmin`,
            height: `${b.d}vmin`,
            background: `radial-gradient(circle at ${b.hx}% ${b.hy}%, ${TONE_FILL[b.tone]} 0%, ${TONE_FILL[b.tone]} 34%, #8fcd69 68%, #6fae4e 100%)`,  /* taste-skill-ignore gradient: 黏土团块/材质/光带的明暗过渡只能靠渐变，这是 3D 捏制质感的物理依据 */
          }}
        />
      ))}

      {LEAVES.map((l, i) => (
        <span
          key={`l${i}`}
          className="canopy__leaf"
          style={{
            left: `${l.x}%`,
            top: `${l.y}vmin`,
            width: `calc(${l.s} * 4vmin)`,
            height: `calc(${l.s} * 4vmin)`,
            transform: `translate(-50%, -50%) rotate(${l.r}deg)`,
          }}
        >
          <svg viewBox="0 0 48 48" style={{ display: 'block', width: '100%', height: '100%' }}>
            <path
              d="M4 44 C 2 26 14 6 44 4 C 46 32 32 44 4 44 Z"
              fill={LEAF_FILL[l.tone]}
            />
            <path d="M8 40 C 18 30 30 18 40 8 C 30 22 18 32 8 40 Z" fill="#71ad52" opacity="0.4" />
            <path d="M10 38 C 20 30 30 20 38 10" stroke="#c2e9a0" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" fill="none" />
          </svg>
        </span>
      ))}

      {BUDS.map((b, i) => (
        <span
          key={`b${i}`}
          className="canopy__bud"
          style={{ left: `${b.x}%`, top: `${b.y}vmin`, width: `calc(${b.s} * 1.1vmin)`, height: `calc(${b.s} * 1.1vmin)` }}
        />
      ))}

      {FLOWERS.map((f, i) => (
        <span key={`f${i}`} className="canopy__flower" style={{ left: `${f.x}%`, top: `${f.y}vmin` }}>
          <Flower s={f.s} c={f.c} />
        </span>
      ))}

      {/* 冠下垂下来的两条细藤，把冠和草地连起来 */}
      <svg className="canopy__trail canopy__trail--l" viewBox="0 0 120 300" fill="none">
        <path d="M54 -6 C 78 52 40 96 66 150 C 88 196 54 236 70 296" stroke="#7fc05c" strokeWidth="7" strokeLinecap="round" />
        {[
          [70, 42, 28],
          [52, 92, -34],
          [74, 146, 30],
          [56, 200, -26],
          [72, 252, 26],
        ].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
            <path d="M0 0 C 13 -18 41 -16 47 2 C 41 22 11 22 0 0 Z" fill={i % 2 === 0 ? '#9fdc77' : '#8fcd69'} />
            <path d="M42 7 C 37 20 17 24 4 11 C 19 18 34 16 42 7 Z" fill="#71ad52" opacity="0.5" />
          </g>
        ))}
      </svg>

      <svg className="canopy__trail canopy__trail--r" viewBox="0 0 120 300" fill="none">
        <path d="M64 -6 C 40 52 78 96 52 150 C 30 196 64 236 48 296" stroke="#7fc05c" strokeWidth="7" strokeLinecap="round" />
        {[
          [46, 42, -28],
          [68, 92, 34],
          [44, 146, -30],
          [62, 200, 26],
          [46, 252, -26],
        ].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
            <path d="M0 0 C 13 -18 41 -16 47 2 C 41 22 11 22 0 0 Z" fill={i % 2 === 0 ? '#8fcd69' : '#9fdc77'} />
            <path d="M42 7 C 37 20 17 24 4 11 C 19 18 34 16 42 7 Z" fill="#71ad52" opacity="0.5" />
          </g>
        ))}
      </svg>
    </div>
  );
}
