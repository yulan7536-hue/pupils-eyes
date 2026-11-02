/**
 * 空气里飘动的晨曦微光点 + 暖白淡金 Bokeh 光斑。
 *
 * 课桌界面（MainLawn）和拼贴花园（CollageScene）共用这一套，
 * 保证两个场景的「空气感」是同一个语言。
 * 纯 CSS 动画，`pointer-events: none` 保证不挡交互。
 */

/** 细小光点 */
const MOTES = [
  { x: 12, y: 62, s: 0.7, d: 0 },
  { x: 20, y: 45, s: 1, d: 1.6 },
  { x: 30, y: 68, s: 0.6, d: 3.1 },
  { x: 41, y: 40, s: 0.85, d: 0.8 },
  { x: 55, y: 57, s: 0.65, d: 2.4 },
  { x: 63, y: 33, s: 0.9, d: 4.2 },
  { x: 72, y: 60, s: 0.7, d: 1.1 },
  { x: 83, y: 44, s: 1, d: 3.6 },
  { x: 92, y: 66, s: 0.6, d: 2 },
  { x: 7, y: 38, s: 0.8, d: 5 },
  { x: 47, y: 74, s: 0.55, d: 4.6 },
  { x: 78, y: 76, s: 0.6, d: 0.4 },
];

/** 暖白 / 淡金 Bokeh 光斑 */
const BOKEH = [
  { x: 8, y: 18, s: 2.6, d: 0 },
  { x: 24, y: 12, s: 3.4, d: 2.2 },
  { x: 44, y: 16, s: 2.2, d: 4.6 },
  { x: 64, y: 10, s: 3.8, d: 1.4 },
  { x: 82, y: 15, s: 2.8, d: 5.2 },
  { x: 95, y: 24, s: 3.2, d: 2.8 },
];

interface FirefliesProps {
  /** 额外的容器类名，用于覆盖层级等 */
  className?: string;
}

export default function Fireflies({ className }: FirefliesProps) {
  return (
    <div className={className ? `motes ${className}` : 'motes'} aria-hidden="true">
      {BOKEH.map((m, i) => (
        <span
          key={`bk${i}`}
          className="mote mote--bokeh"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: `calc(var(--u) * ${1.6 * m.s})`,
            height: `calc(var(--u) * ${1.6 * m.s})`,
            animationDelay: `${-m.d}s`,
          }}
        />
      ))}
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="mote"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: `calc(var(--u) * ${0.7 * m.s})`,
            height: `calc(var(--u) * ${0.7 * m.s})`,
            animationDelay: `${-m.d}s`,
          }}
        />
      ))}
    </div>
  );
}
