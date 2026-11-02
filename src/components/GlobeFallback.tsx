import { useEffect, useState } from 'react';
import type { PinItem } from '../types';

/**
 * 没有 WebGL 时的黏土地球仪（2D）。
 * 用同样的莫兰迪泥色与投影把球、底座、小灯立起来，功能（自转 / 悬停 / 点击放大）不变。
 * 被点亮的那几盏灯同样会透出暖光。
 */
export default function GlobeFallback({
  pins,
  size,
  litPinIds,
  onToggleZoom,
  zoomed,
}: {
  pins: PinItem[];
  size: number;
  litPinIds: Set<string>;
  onToggleZoom: () => void;
  zoomed: boolean;
}) {
  const [angle, setAngle] = useState(0.4);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      setAngle((a) => a + dt * 0.16);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const R = 39; // 球半径占容器宽度的百分比

  return (
    <div
      style={{ position: 'relative', width: size, height: size, cursor: zoomed ? 'zoom-out' : 'grab' }}
      onClick={onToggleZoom}
      role="img"
      aria-label="黏土地球仪"
    >
      {/* 底座 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '2%',
          width: '62%',
          height: '9%',
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 38% 30%, #c8ae8a, #b1966f 60%, #9c7f5b)',  // taste-skill-ignore gradient: 黏土球体/光斑的明暗过渡只能靠渐变，这是 3D 捏制质感的物理依据
          boxShadow: '0 8px 18px rgba(60,70,58,.28)',
        }}
      />

      {/* 球体 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '7%',
          width: `${R * 2}%`,
          height: `${R * 2}%`,
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at 33% 27%, #c6d3c2 0%, #a8b9ad 34%, #94a9a2 62%, #7f968f 84%, #718882 100%)',  // taste-skill-ignore gradient: 黏土球体/光斑的明暗过渡只能靠渐变，这是 3D 捏制质感的物理依据
          boxShadow:
            'inset -14px -18px 30px rgba(58,72,64,.34), inset 10px 12px 24px rgba(255,255,255,.34), 0 16px 28px -12px rgba(58,72,64,.5)',
        }}
      >
        {/* 陆块：靠水平位移假装在自转 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translateX(${Math.sin(angle) * 18}%)`,
            transition: 'transform .1s linear',
          }}
        >
          <div style={{ position: 'absolute', left: '8%', top: '18%', width: '46%', height: '34%', background: '#93a98b', borderRadius: '58% 42% 46% 54% / 54% 48% 52% 46%', opacity: 0.95 }} />
          <div style={{ position: 'absolute', left: '58%', top: '26%', width: '38%', height: '44%', background: '#8fa787', borderRadius: '44% 56% 52% 48% / 46% 52% 48% 54%', opacity: 0.92 }} />
          <div style={{ position: 'absolute', left: '30%', top: '58%', width: '34%', height: '26%', background: '#849c7e', borderRadius: '52% 48% 42% 58% / 48% 54% 46% 52%', opacity: 0.9 }} />
          <div style={{ position: 'absolute', left: '20%', top: '10%', width: '20%', height: '14%', background: '#c9b489', borderRadius: '52% 48% 46% 54%', opacity: 0.85 }} />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 30% 24%, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,0) 64%, rgba(46,60,54,.28) 100%)',  // taste-skill-ignore gradient: 黏土球体/光斑的明暗过渡只能靠渐变，这是 3D 捏制质感的物理依据
          }}
        />
      </div>

      {/* 小灯：灯珠在上、灯杆居中、泥底座压在最下面，整盏灯站在球面上 */}
      {pins.map((pin) => {
        const lam = ((pin.lon + 180) * Math.PI) / 180 + angle;
        const phi = ((90 - pin.lat) * Math.PI) / 180;
        const x = -Math.sin(phi) * Math.cos(lam);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(lam);
        if (z < 0.06) return null;
        const isTeacher = pin.role === 'TEACHER';
        const lit = litPinIds.has(pin.id);
        const w = Math.max(8, Math.round(size * 0.032));
        return (
          <span
            key={pin.id}
            title={`童眼看 ${pin.city.split('·').pop()}${lit ? ' · 已点亮' : ''}`}
            style={{
              position: 'absolute',
              left: `${50 + x * R}%`,
              top: `${7 + R - y * R}%`,
              transform: 'translate(-50%, -100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: w,
              opacity: 0.6 + z * 0.4,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <span
              style={{
                width: Math.round(w * 0.82),
                height: Math.round(w * 0.82),
                borderRadius: '50%',
                border: '1px solid rgba(176,138,84,.6)',
                background: lit
                  ? 'radial-gradient(circle at 38% 32%, #fffbef 0%, #ffd79a 46%, #f0a75d 100%)'
                  : 'radial-gradient(circle at 38% 32%, #fffaf2 0%, #f1e5cf 56%, #dcc8a6 100%)',
                boxShadow: lit
                  ? `0 0 ${Math.round(w * 0.5)}px ${Math.round(w * 0.28)}px rgba(255,186,104,.62), inset -1px -1px 2px rgba(120,80,30,.32)`
                  : 'inset -1px -1px 2px rgba(90,70,40,.3)',
              }}
            />
            <span
              style={{
                width: w,
                height: Math.max(2, Math.round(w * 0.16)),
                borderRadius: '50%',
                background: isTeacher ? '#c07b70' : '#d3a97a',
                boxShadow: '0 1px 2px rgba(40,50,44,.35)',
              }}
            />
          </span>
        );
      })}
    </div>
  );
}
