import { useMemo, useRef } from 'react';
import Desk from './Desk';
import Canopy from './Canopy';
import GlobeStage from './GlobeStage';
import type { PinItem, WorkItem } from '../types';

interface MainLawnProps {
  pins: PinItem[];
  works: WorkItem[];
  globeOpen: boolean;
  /** 地球仪放大时是否显示"回到课桌"的关闭按钮（有弹窗时让位给弹窗） */
  globeChrome: boolean;
  onToggleGlobe: () => void;
  activeTargetCoord: { lat: number; lon: number } | null;
  newlyDroppedPinId: string | null;
  /** 落钉特写要打在钉子上，所以把钉子的屏幕坐标抛给上层 */
  onPinAnchor: (at: { x: number; y: number } | null) => void;
  onOpenBook: (book: 'note' | 'album') => void;
  onOpenUpload: () => void;
  /** 打开「行智开物 × 童眼」工作台（感官打捞 + 四维打磨） */
  onOpenStudio: () => void;
  /** 切到绘本课桌（纯 CSS 3D 桌面） */
  onOpenDesk: () => void;
  onSelectPin: (pin: PinItem) => void;
  onReplay: () => void;
}

const TUFTS = [46, 72, 38, 88, 56, 96, 44, 76, 50, 84, 40, 66, 34, 80, 48, 70, 42, 92, 54, 64];

/** 远坡上的一排树冠（x, y, r），下半截被前面的山脊挡住 */
const GROVE: [number, number, number][] = [
  [90, 374, 18],
  [196, 356, 28],
  [318, 348, 22],
  [452, 326, 26],
  [548, 310, 17],
  [676, 320, 29],
  [782, 334, 20],
  [906, 316, 15],
  [1010, 306, 27],
  [1128, 320, 19],
  [1246, 314, 25],
  [1352, 310, 16],
];

/** 空气里飘的光点：参考插画里散在场景中的小萤火 */
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
  { x: 16, y: 30, s: 0.9, d: 2.8 },
  { x: 36, y: 52, s: 0.7, d: 5.4 },
  { x: 68, y: 25, s: 1.05, d: 1.9 },
  { x: 89, y: 52, s: 0.75, d: 3.3 },
  { x: 51, y: 22, s: 0.6, d: 6.1 },
  { x: 26, y: 78, s: 0.5, d: 4.1 },
];

/** 背景里的大颗柔和 Bokeh 光斑：暖白/淡金，缓慢漂浮 */
const BOKEH = [
  { x: 8, y: 18, s: 2.6, d: 0 },
  { x: 24, y: 12, s: 3.4, d: 2.2 },
  { x: 44, y: 16, s: 2.2, d: 4.6 },
  { x: 64, y: 10, s: 3.8, d: 1.4 },
  { x: 82, y: 15, s: 2.8, d: 5.2 },
  { x: 95, y: 24, s: 3.2, d: 2.8 },
  { x: 14, y: 34, s: 2.4, d: 3.6 },
  { x: 55, y: 30, s: 2.9, d: 0.9 },
  { x: 74, y: 38, s: 2.3, d: 4.1 },
  { x: 90, y: 44, s: 2.6, d: 2.4 },
  { x: 33, y: 8, s: 2.5, d: 1.7 },
  { x: 69, y: 52, s: 2.1, d: 3.4 },
  { x: 5, y: 50, s: 2.7, d: 2.1 },
  { x: 49, y: 60, s: 2.4, d: 5.6 },
];

/** 草坪上的黏土小花：只放几处，给空场一点活气 */
function LawnDecor() {
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}
    >
      {[
        { left: '17%', bottom: '2%', s: 1 },
        { left: '26%', bottom: '6%', s: 0.8 },
        { left: '76%', bottom: '3%', s: 1.1 },
        { left: '86%', bottom: '7%', s: 0.85 },
        { left: '7%', bottom: '10%', s: 0.9 },
        { left: '94%', bottom: '13%', s: 0.75 },
      ].map((f, i) => (
        <svg
          key={`f${i}`}
          viewBox="0 0 40 52"
          style={{
            position: 'absolute',
            left: f.left,
            bottom: f.bottom,
            width: `calc(var(--u) * ${3.4 * f.s})`,
            height: `calc(var(--u) * ${4.4 * f.s})`,
            transform: 'translateX(-50%)',
          }}
        >
          <path d="M20 52 C 20 40 20 32 20 24" stroke="#7cb356" strokeWidth="2.6" strokeLinecap="round" />
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx="20" cy="14" rx="5.2" ry="8" fill="#f8f3da" transform={`rotate(${deg} 20 20)`} />
          ))}
          <circle cx="20" cy="20" r="4" fill="#ecc96b" />
        </svg>
      ))}
    </div>
  );
}

/** 地平线上的草叶fringe：让草坪的顶边不是一刀切 */
const BLADE_H = [52, 74, 40, 88, 64, 46, 96, 58, 80, 44, 70, 92, 50, 78, 62, 86, 42, 68, 98, 54, 76, 48, 90, 60, 82, 46, 72, 94, 56, 66, 84, 50];

function BladeFringe() {
  return (
    <div className="lawn__blades" aria-hidden="true">
      {BLADE_H.map((h, i) => (
        <svg key={i} viewBox="0 0 24 100" style={{ height: `${h}%` }}>
          <path d="M12 100 C 11 74 7 52 2 34 C 9 54 12 74 13 100 Z" fill="#7cb356" />
          <path d="M13 100 C 14 70 18 50 22 32 C 18 52 14 72 15 100 Z" fill="#93c86c" />
        </svg>
      ))}
    </div>
  );
}

/** 飘浮光点 + 空气感 Bokeh 光斑 */
function Fireflies() {
  return (
    <div className="motes" aria-hidden="true">
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

function Tuft({ h }: { h: number }) {
  return (
    <svg viewBox="0 0 120 100" preserveAspectRatio="none" style={{ height: `${h}%` }} aria-hidden="true">
      <path d="M62 100 C 58 66 48 42 26 22 C 50 40 60 66 64 100 Z" fill="#77b050" />
      <path d="M64 100 C 62 58 56 34 40 8 C 58 32 65 60 68 100 Z" fill="#8ac361" />
      <path d="M66 100 C 68 62 76 38 96 18 C 80 44 71 70 70 100 Z" fill="#9ad16d" />
      <path d="M60 100 C 54 70 42 54 18 44 C 42 56 57 74 62 100 Z" fill="#82ba58" />
      <path d="M68 100 C 72 72 84 56 106 48 C 86 60 74 76 71 100 Z" fill="#8ac361" />
      <path d="M63 100 C 63 64 66 44 74 26 C 70 48 68 70 68 100 Z" fill="#a2d976" />
      <path d="M64 100 C 60 74 52 60 34 52 C 54 62 62 78 66 100 Z" fill="#6fa548" />
    </svg>
  );
}

export default function MainLawn({
  pins,
  works,
  globeOpen,
  globeChrome,
  onToggleGlobe,
  activeTargetCoord,
  newlyDroppedPinId,
  onPinAnchor,
  onOpenBook,
  onOpenUpload,
  onOpenStudio,
  onOpenDesk,
  onSelectPin,
  onReplay,
}: MainLawnProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);

  const noteCount = useMemo(() => works.filter((w) => w.role === 'TEACHER').length, [works]);
  const albumCount = useMemo(() => works.filter((w) => w.role === 'STUDENT').length, [works]);

  return (
    <>
    <div className="scene stage-in">
      <div className="scene__field" aria-hidden="true" />
      <div className="scene__haze" aria-hidden="true" />

      {/* 远坡：一条极淡的地平线，只负责把天和草分开，不抢树冠的戏 */}
      <div className="scene__hills" aria-hidden="true">
        <svg viewBox="0 0 1440 640" preserveAspectRatio="none">
          <path
            fill="var(--hill-far)"
            d="M0 452 C 150 424 268 442 402 420 C 542 396 674 428 806 410 C 940 392 1088 420 1226 402 C 1320 390 1396 396 1440 392 L1440 640 L0 640 Z"
          />
          <g>
            {GROVE.map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y + 96} r={r} fill={i % 3 === 0 ? '#b6d38e' : '#c0da9a'} />
            ))}
          </g>
          <path
            fill="var(--hill-mid)"
            d="M0 486 C 156 456 282 474 420 452 C 570 428 706 460 862 444 C 1006 428 1160 454 1300 440 C 1364 434 1414 438 1440 436 L1440 640 L0 640 Z"
          />
        </svg>
      </div>

      {/* 树冠：横跨顶部的深绿黏土拱廊 */}
      <Canopy />

      {/* 魔法草坪：一整块压出来的黏土台面，顶边是圆润的草脊 */}
      <div className="lawn" aria-hidden="true">
        <div className="lawn__body">
          <div className="lawn__patch lawn__patch--a" />
          <div className="lawn__patch lawn__patch--b" />
          <BladeFringe />
        </div>
      </div>

      <LawnDecor />
      <div className="scene__glow" aria-hidden="true" />
      <Fireflies />

      {/* 顶部 UI：无边框，白字压一圈奶油描边，直接坐在树冠上 */}
      <header className="hud">
        <h1 className="hud__title">
          <span className="hud__kicker">童眼看世界 · 行智开物</span>
          <span className="hud__headline">成果展示</span>
        </h1>
        <div className="hud__right">
          <button type="button" className="hud__action" onClick={onOpenUpload}>
            上传课题
          </button>
          <button
            type="button"
            className="hud__action hud__action--studio"
            onClick={onOpenStudio}
          >
            感官工作台
          </button>
          <button
            type="button"
            className="hud__action hud__action--studio"
            onClick={onOpenDesk}
          >
            绘本课桌
          </button>
        </div>
      </header>

      <Desk
        noteCount={noteCount}
        albumCount={albumCount}
        onOpenNote={() => onOpenBook('note')}
        onOpenAlbum={() => onOpenBook('album')}
        globeSlotRef={slotRef}
      />

      {/* 前景草丛：压在桌腿前，拉开前后层次 */}
      <div className="tufts" aria-hidden="true">
        {TUFTS.map((h, i) => (
          <Tuft key={i} h={h} />
        ))}
      </div>

      <button type="button" className="hud__replay" onClick={onReplay}>
        重温开场
      </button>
    </div>

    {/* 地球仪浮层：与「绘本课桌」共用同一颗球 */}
    <GlobeStage
      slotRef={slotRef}
      pins={pins}
      zoomed={globeOpen}
      chrome={globeChrome}
      activeTargetCoord={activeTargetCoord}
      newlyDroppedPinId={newlyDroppedPinId}
      onSelectPin={onSelectPin}
      onToggleZoom={onToggleGlobe}
      onPinAnchor={onPinAnchor}
    />
    </>
  );
}
