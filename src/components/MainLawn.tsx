import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import Desk from './Desk';
import ClayGlobe from './ClayGlobe';
import Fireflies from './Fireflies';
import { WISTERIA_STRANDS } from './wisteriaStrands';
import type { PinItem, WorkItem } from '../types';

/**
 * 背景四层资源的地址。
 *
 * 这里必须拿到绝对地址，光拼 BASE_URL 不够：构建用相对 base（'./'）时，
 * `--wis: url('./scene/…')` 这种写在 style 里的自定义属性，浏览器会拿**样式表的地址**
 * 去解析，于是变成 /assets/scene/wisteria.webp，404。先跟文档地址合一次就没事了。
 */
const ASSET = new URL(import.meta.env.BASE_URL, document.baseURI).href;
const SCENE_LAYERS = {
  base: `${ASSET}scene/base.webp`,
  wisteria: `${ASSET}scene/wisteria.webp`,
  bloomLeft: `${ASSET}scene/bloom-left.webp`,
  bloomRight: `${ASSET}scene/bloom-right.webp`,
} as const;

interface MainLawnProps {
  pins: PinItem[];
  works: WorkItem[];
  /** 已被点亮的成果 id，球面上对应的那盏小灯会亮 */
  litPinIds: Set<string>;
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
  /** 打开「拼贴花园」模式（2.5D 可旋转场景 + 贴纸） */
  onOpenCollage: () => void;
  onSelectPin: (pin: PinItem) => void;
  onReplay: () => void;
  /** 新增：《古墓丽影》风格 3D 文物建筑检视回调 */
  onInspectArtifact?: (key: string) => void;
}

const TUFTS = [46, 72, 38, 88, 56, 96, 44, 76, 50, 84, 40, 66, 34, 80, 48, 70, 42, 92, 54, 64];

function Tuft({ h }: { h: number }) {
  return (
    <svg viewBox="0 0 120 100" preserveAspectRatio="none" style={{ height: `${h}%` }} aria-hidden="true">
      <path d="M62 100 C 58 66 48 42 26 22 C 50 40 60 66 64 100 Z" fill="#77b050" />
      <path d="M64 100 C 62 58 56 34 40 8 C 58 32 65 60 68 100 Z" fill="#8ac361" />
      <path d="M66 100 C 68 62 76 38 96 18 C 80 44 71 70 70 100 Z" fill="#9ad16d" />
      <path d="M60 100 C 54 70 42 54 18 44 C 42 56 57 74 62 100 Z" fill="#82ba58" />
    </svg>
  );
}

export default function MainLawn({
  pins,
  works,
  litPinIds,
  globeOpen,
  globeChrome,
  onToggleGlobe,
  activeTargetCoord,
  newlyDroppedPinId,
  onPinAnchor,
  onOpenBook,
  onOpenUpload,
  onOpenStudio,
  onOpenCollage,
  onSelectPin,
  onReplay,
  onInspectArtifact,
}: MainLawnProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const [globeSize, setGlobeSize] = useState(600);
  const [dock, setDock] = useState({ x: 0, y: 0, scale: 0.3 });
  const [hover, setHover] = useState<{ pin: PinItem; x: number; y: number } | null>(null);
  const [isWisteriaSwaying, setIsWisteriaSwaying] = useState(false);

  const noteCount = useMemo(() => works.filter((w) => w.role === 'TEACHER').length, [works]);
  const albumCount = useMemo(() => works.filter((w) => w.role === 'STUDENT').length, [works]);

  // Esc 退出地球仪放大
  useEffect(() => {
    if (!globeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggleGlobe();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [globeOpen, onToggleGlobe]);

  // 地球仪自适应尺寸
  useEffect(() => {
    const measureSize = () => {
      setGlobeSize(Math.min(window.innerHeight * 0.78, window.innerWidth * 0.94, 640));
    };
    measureSize();
    window.addEventListener('resize', measureSize);
    return () => window.removeEventListener('resize', measureSize);
  }, []);

  // 将地球仪精准对位到书桌的凹槽中
  useEffect(() => {
    const measure = () => {
      const el = slotRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDock({
        x: r.left + r.width / 2 - window.innerWidth / 2,
        y: r.top + r.height / 2 - window.innerHeight / 2,
        scale: r.width / globeSize,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    const t = window.setTimeout(measure, 120);
    return () => {
      window.removeEventListener('resize', measure);
      window.clearTimeout(t);
    };
  }, [globeSize]);

  // 鼠标划过紫藤触发摆动
  const triggerWisteria = () => {
    setIsWisteriaSwaying(false);
    setTimeout(() => setIsWisteriaSwaying(true), 10);
  };

  const globeStyle = {
    '--globe-size': `${globeSize}px`,
    '--gx': globeOpen ? '0px' : `${dock.x}px`,
    '--gy': globeOpen ? '0px' : `${dock.y}px`,
    '--gs': globeOpen ? 1 : dock.scale,
  } as CSSProperties;

  return (
    <>
    <div className="scene stage-in">
      {/* 1. 背景拆成四层：底图 → 书桌 → 左右粉花树 → 顶部紫藤。
             分层是为了让"只有花动"：整张图一起晃会晕，只有花自己摆才像风。 */}
      <div
        className="scene__photo"
        style={{ backgroundImage: `url('${SCENE_LAYERS.base}')` }}
        aria-hidden="true"
      />

      {/* 2. 顶层紫藤：一挂一栏，各绕自己顶端摆（栏位由 cutout 脚本按花串空隙切出来）。
             整层一起转等于把画框顶边当合页，串与串之间没有相对运动，看着像画在晃。 */}
      <div
        className="scene__wisteria"
        style={{ '--wis': `url('${SCENE_LAYERS.wisteria}')` } as CSSProperties}
        aria-hidden="true"
      >
        {/* 会动的那一层单独包起来：鼠标掠过的"一记风"只推这一层，
            顶盖不跟着转，否则整层一转，刚钉死的藤冠又被推走了。 */}
        <div className={`wisteria__body${isWisteriaSwaying ? ' is-nudge' : ''}`}>
          {WISTERIA_STRANDS.map((s, i) => (
            <div
              key={i}
              className="wisteria__strand"
              style={{
                left: `${s.left}%`,
                width: `${s.width}%`,
                '--amp': s.amp,
                '--dur': `${s.dur}s`,
                '--delay': `${s.delay}s`,
              } as CSSProperties}
            >
              <div
                className="wisteria__img"
                style={{ left: `${s.imgLeft}%`, width: `${s.imgWidth}%` }}
              />
            </div>
          ))}
        </div>

        {/* 顶盖：一张不参与动画的同款底片，只留最上面那截藤冠。
            栏是按列切的，转起来之后顶部这一片密密麻麻的藤冠会被相邻栏
            拉出几像素的错位，远看就是"整个顶在晃"。盖上这一层，藤冠是死的，
            只有下方的花串在摆 —— 也就是真花的样子：上面缠在架子上，下面随风摆。
            盖层是同一张图、同一处取景，静止时与下方完全重合，看不出接缝。 */}
        <div className="wisteria__cap" />
      </div>

      {/* 3. 左右两棵边缘粉色花树，各自绕树根摆 */}
      <div
        className="scene__flora scene__flora--left"
        style={{ backgroundImage: `url('${SCENE_LAYERS.bloomLeft}')` }}
        aria-hidden="true"
      />
      <div
        className="scene__flora scene__flora--right"
        style={{ backgroundImage: `url('${SCENE_LAYERS.bloomRight}')` }}
        aria-hidden="true"
      />

      {/* 4. 顶部紫藤鼠标微风交互热区 */}
      <div
        className="wisteria-hover-zone"
        onMouseEnter={triggerWisteria}
        title="微风拂过紫藤"
      />

      {/* 3. 画面中各大洲代表性建筑的交互热区（点击呼出《古墓丽影》3D 检视器） */}
      {onInspectArtifact && (
        <div className="garden-interactive-overlay">
          <div 
            className="hotspot-pin pin-chinese-pavilion"
            onClick={() => onInspectArtifact('pavilion')}
            title="点击检视：亚洲 · 中式水榭凉亭"
          >
            <span className="hotspot-pulse" />
            <span className="hotspot-chip">亚洲 · 中式水榭</span>
          </div>

          <div 
            className="hotspot-pin pin-roman-arch"
            onClick={() => onInspectArtifact('arch')}
            title="点击检视：欧洲 · 古罗马柱廊"
          >
            <span className="hotspot-pulse" />
            <span className="hotspot-chip">欧洲 · 柱廊拱门</span>
          </div>

          <div 
            className="hotspot-pin pin-sydney-opera"
            onClick={() => onInspectArtifact('opera')}
            title="点击检视：大洋洲 · 悉尼歌剧院"
          >
            <span className="hotspot-pulse" />
            <span className="hotspot-chip">大洋洲 · 悉尼白帆</span>
          </div>
        </div>
      )}

      {/* 4. 晨光粒子 */}
      <div className="scene__glow" aria-hidden="true" />
      <Fireflies />

      {/* 5. 顶部双语题字 HUD */}
      <header className="hud">
        <h1 className="hud__title">
          <span className="hud__kicker">童眼看世界 · 行智开物</span>
          <span className="hud__kicker-en" lang="en">
            Through Children&apos;s Eyes · Mind &amp; Craft
          </span>
          <span className="hud__headline">成果展示</span>
          <span className="hud__headline-en" lang="en">
            Selected Artifacts &amp; Works
          </span>
        </h1>
        <div className="hud__right">
          <button type="button" className="hud__action" onClick={onOpenUpload}>
            <span className="btn-cn">上传课题</span>
            <span className="btn-en" lang="en">
              Submit Research
            </span>
          </button>
          <button
            type="button"
            className="hud__action hud__action--studio"
            onClick={onOpenStudio}
          >
            <span className="btn-cn">感官工作台</span>
            <span className="btn-en" lang="en">
              Sensory Atelier
            </span>
          </button>
          <button
            type="button"
            className="hud__action hud__action--collage"
            onClick={onOpenCollage}
          >
            <span className="btn-cn">拼贴花园</span>
            <span className="btn-en" lang="en">
              Collage Garden
            </span>
          </button>
        </div>
      </header>

      {/* 6. 核心展示木长凳（连通手账、相册与地球仪） */}
      <Desk
        noteCount={noteCount}
        albumCount={albumCount}
        onOpenNote={() => onOpenBook('note')}
        onOpenAlbum={() => onOpenBook('album')}
        globeSlotRef={slotRef}
      />

      {/* 前景原生微草草丛（压在桌腿前，增强前后遮挡层次） */}
      <div className="tufts" aria-hidden="true">
        {TUFTS.map((h, i) => (
          <Tuft key={i} h={h} />
        ))}
      </div>

      {/* 右下角重温开场 */}
      <button type="button" className="hud__replay" onClick={onReplay}>
        <span className="btn-cn">重温开场</span>
        <span className="btn-en" lang="en">
          Replay Prologue
        </span>
      </button>
    </div>

    {/* 地球仪独立挂载层（保证放大时不被遮罩模糊，全量保留） */}
    {createPortal(
      <>
        {globeOpen && (
          <div className="veil veil--globe" onClick={onToggleGlobe} aria-hidden="true" />
        )}

        <div className="globe-layer" data-zoomed={globeOpen} style={globeStyle}>
          <ClayGlobe
            pins={pins}
            size={globeSize}
            litPinIds={litPinIds}
            zoomed={globeOpen}
            activeTargetCoord={activeTargetCoord}
            newlyDroppedPinId={newlyDroppedPinId}
            onSelectPin={onSelectPin}
            onToggleZoom={onToggleGlobe}
            onHoverPin={(pin, x, y) => setHover(pin ? { pin, x, y } : null)}
            onPinAnchor={onPinAnchor}
          />
        </div>

        {hover && (
          <div className="pin-tip" style={{ left: hover.x, top: hover.y - 14 }} role="status">
            <span
              className={`pin-tip__dot${litPinIds.has(hover.pin.id) ? ' is-lit' : ''}`}
              aria-hidden="true"
            />
            童眼看 {hover.pin.city.split('·').pop()}
            {litPinIds.has(hover.pin.id) && <span className="pin-tip__lit">灯已亮</span>}
          </div>
        )}
      </>,
      document.body
    )}

    {globeChrome && (
      <button
        type="button"
        className="veil__close globe-close"
        onClick={onToggleGlobe}
        aria-label="回到课桌"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    )}
    </>
  );
}
