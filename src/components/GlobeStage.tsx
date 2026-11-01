import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import ClayGlobe from './ClayGlobe';
import type { PinItem } from '../types';

interface GlobeStageProps {
  /** 课桌上给地球仪预留的落座位，靠它把球从屏幕正中平移到桌上 */
  slotRef: RefObject<HTMLDivElement | null>;
  pins: PinItem[];
  zoomed: boolean;
  /** 放大时是否显示关闭按钮（有弹窗时让位给弹窗） */
  chrome: boolean;
  activeTargetCoord: { lat: number; lon: number } | null;
  newlyDroppedPinId: string | null;
  onSelectPin: (pin: PinItem) => void;
  onToggleZoom: () => void;
  /** 落钉特写要打在钉子上，所以把钉子的屏幕坐标抛给上层 */
  onPinAnchor: (at: { x: number; y: number } | null) => void;
  /**
   * 静止时把真球藏起来。绘本课桌的台面上自己画了一颗 CSS 黏土球，
   * 真球只在放大时才现身，否则两颗球会叠在一起。
   */
  idleHidden?: boolean;
  /**
   * 关闭按钮的皮肤。草坪场景是深绿底，奶白圆片够用；
   * 课桌是纸白底，同色圆片会彻底看不见，需要墨线版。
   */
  chromeTone?: 'cream' | 'toon';
}

/**
 * 地球仪浮层：尺寸测量、落座平移、放大遮罩、悬停气泡都在这里。
 *
 * 挂到 body 上而不是留在场景里——`.scene` 的裁剪与合成层会让整颗球
 * 跟着背景一起被高斯模糊掉。抽成独立组件是为了让「草坪场景」和
 * 「绘本课桌」两个入口共用同一套球，不各写一遍。
 */
export default function GlobeStage({
  slotRef,
  pins,
  zoomed,
  chrome,
  activeTargetCoord,
  newlyDroppedPinId,
  onSelectPin,
  onToggleZoom,
  onPinAnchor,
  idleHidden = false,
  chromeTone = 'cream',
}: GlobeStageProps) {
  const [size, setSize] = useState(600);
  const [dock, setDock] = useState({ x: 0, y: 0, scale: 0.3 });
  const [hover, setHover] = useState<{ pin: PinItem; x: number; y: number } | null>(null);

  // 画布边长：随视口变化，封顶 640
  useEffect(() => {
    const measureSize = () => {
      setSize(Math.min(window.innerHeight * 0.78, window.innerWidth * 0.94, 640));
    };
    measureSize();
    window.addEventListener('resize', measureSize);
    return () => window.removeEventListener('resize', measureSize);
  }, []);

  // 量出落座位，把球从"屏幕正中"平移到桌上
  useEffect(() => {
    const measure = () => {
      const el = slotRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDock({
        x: r.left + r.width / 2 - window.innerWidth / 2,
        y: r.top + r.height / 2 - window.innerHeight / 2,
        scale: r.width / size,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    // 首帧字体/布局未定时再补量一次
    const t = window.setTimeout(measure, 120);
    return () => {
      window.removeEventListener('resize', measure);
      window.clearTimeout(t);
    };
  }, [size, slotRef]);

  // 放大态下 Esc 退回课桌
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggleZoom();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed, onToggleZoom]);

  const globeStyle = {
    '--globe-size': `${size}px`,
    '--gx': zoomed ? '0px' : `${dock.x}px`,
    '--gy': zoomed ? '0px' : `${dock.y}px`,
    '--gs': zoomed ? 1 : dock.scale,
  } as CSSProperties;

  return (
    <>
      {createPortal(
        <>
          {/* 放大时的背景：整屏高斯模糊，只剩球体清晰 */}
          {zoomed && <div className="veil veil--globe" onClick={onToggleZoom} aria-hidden="true" />}

          <div
            className="globe-layer"
            data-zoomed={zoomed}
            data-idle={idleHidden ? 'true' : undefined}
            style={globeStyle}
          >
            <ClayGlobe
              pins={pins}
              size={size}
              zoomed={zoomed}
              activeTargetCoord={activeTargetCoord}
              newlyDroppedPinId={newlyDroppedPinId}
              onSelectPin={onSelectPin}
              onToggleZoom={onToggleZoom}
              onHoverPin={(pin, x, y) => setHover(pin ? { pin, x, y } : null)}
              onPinAnchor={onPinAnchor}
            />
          </div>

          {hover && (
            <div className="pin-tip" style={{ left: hover.x, top: hover.y - 14 }} role="status">
              童眼看 {hover.pin.city.split('·').pop()}
            </div>
          )}
        </>,
        document.body
      )}

      {chrome && (
        <button
          type="button"
          className={`veil__close globe-close${chromeTone === 'toon' ? ' globe-close--toon' : ''}`}
          onClick={onToggleZoom}
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
