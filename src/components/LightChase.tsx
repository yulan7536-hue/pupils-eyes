import { useEffect, useRef, useState } from 'react';
import { storySound } from '../utils/sound';

interface LightChaseProps {
  /** 白光铺满全屏的瞬间：上层把主场景挂到下面 */
  onReveal: () => void;
  /** 光晕消散完毕：这一层可以卸载了 */
  onDone: () => void;
}

const FLEE_RADIUS = 320; // 进入这个半径，光点开始逃
const FOLLOW_TARGET = 2.5; // 持续追随 2.5 秒后定格
const AUTO_SETTLE_MS = 7000; // 没有任何指针输入时的兜底

export default function LightChase({ onReveal, onDone }: LightChaseProps) {
  const moteRef = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(false);
  const [phase, setPhase] = useState<'chase' | 'burst' | 'dissolve'>('chase');

  const settledRef = useRef(false);
  const phaseRef = useRef<'chase' | 'burst' | 'dissolve'>('chase');

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const mote = moteRef.current;
    if (!mote) return;

    const reduces = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const cw = () => window.innerWidth;
    const ch = () => window.innerHeight;

    const pos = { x: cw() / 2, y: ch() / 2 };
    const vel = { x: 0, y: 0 };
    // 指针还没出现时丢在画面外，光点就安静地停在正中
    const pointer = { x: -9999, y: -9999, speed: 0 };
    let follow = 0;
    let last = performance.now();
    let lastMove = performance.now();
    let raf = 0;

    const settle = () => {
      if (settledRef.current) return;
      settledRef.current = true;
      vel.x = 0;
      vel.y = 0;
      setSettled(true);
      storySound.playChime();
    };

    if (reduces) settle();

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const dt = Math.max((now - lastMove) / 1000, 0.008);
      lastMove = now;
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      const inst = Math.min(Math.hypot(dx, dy) / dt, 6000);
      // 平滑一下，避免抖动让光点弹跳
      pointer.speed = pointer.speed * 0.55 + inst * 0.45;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };

    window.addEventListener('pointermove', onMove);

    const autoSettle = window.setTimeout(() => {
      if (!settledRef.current) settle();
    }, AUTO_SETTLE_MS);

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (!settledRef.current && phaseRef.current === 'chase') {
        // 指针停住后速度自然衰减，光点也就不再被推着跑
        pointer.speed *= Math.pow(0.12, dt);

        const dx = pos.x - pointer.x;
        const dy = pos.y - pointer.y;
        const d = Math.hypot(dx, dy) || 1;

        let ax = 0;
        let ay = 0;

        if (d < FLEE_RADIUS) {
          // 离得越近，逃得越急；方向 = 远离指针 + 一点切向的螺旋，像一粒被惊动的光子
          const force = (1 - d / FLEE_RADIUS) ** 1.4;
          const swirl = 0.45 * Math.sin(now * 0.0016);
          const ux = dx / d;
          const uy = dy / d;
          ax += (ux * Math.cos(swirl) - uy * Math.sin(swirl)) * force * 3200;
          ay += (ux * Math.sin(swirl) + uy * Math.cos(swirl)) * force * 3200;
        }

        // 很轻的回中力，避免它一直贴边
        ax += (cw() / 2 - pos.x) * 0.55;
        ay += (ch() / 2 - pos.y) * 0.55;

        vel.x += ax * dt;
        vel.y += ay * dt;

        // 阻尼
        const damp = Math.pow(0.1, dt);
        vel.x *= damp;
        vel.y *= damp;

        // 逃逸速度略快于指针速度
        const maxSpeed = Math.max(760, pointer.speed * 1.5);
        const sp = Math.hypot(vel.x, vel.y);
        if (sp > maxSpeed) {
          vel.x = (vel.x / sp) * maxSpeed;
          vel.y = (vel.y / sp) * maxSpeed;
        }

        pos.x += vel.x * dt;
        pos.y += vel.y * dt;

        // 弹性边界：不许逃出画面
        const padX = Math.max(70, cw() * 0.08);
        const padY = Math.max(70, ch() * 0.1);
        if (pos.x < padX) {
          pos.x = padX;
          vel.x = Math.abs(vel.x) * 0.7;
        } else if (pos.x > cw() - padX) {
          pos.x = cw() - padX;
          vel.x = -Math.abs(vel.x) * 0.7;
        }
        if (pos.y < padY) {
          pos.y = padY;
          vel.y = Math.abs(vel.y) * 0.7;
        } else if (pos.y > ch() - padY) {
          pos.y = ch() - padY;
          vel.y = -Math.abs(vel.y) * 0.7;
        }

        // 累计追随时长：指针真的在动、且确实在追它
        if (pointer.speed > 24 && d < 700) follow += dt;
        if (follow >= FOLLOW_TARGET) settle();
      }

      mote.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.clearTimeout(autoSettle);
    };
  }, []);

  const handleClick = () => {
    if (!settledRef.current || phaseRef.current !== 'chase') return;
    storySound.playLightSparkle();
    setPhase('burst');
    // 白光铺满的瞬间挂上主场景，随后光晕收缩消散，把场景让出来
    window.setTimeout(onReveal, 600);
    window.setTimeout(() => setPhase('dissolve'), 620);
    window.setTimeout(onDone, 1660);
  };

  const dissolving = phase === 'dissolve';

  return (
    <div
      className="chase"
      style={{
        background: dissolving ? 'transparent' : '#000',
        pointerEvents: dissolving ? 'none' : 'auto',
        cursor: settled ? 'default' : 'none',
      }}
    >
      {/* 光点本体：静止时在正中浮现；点击光点本身即跳转 */}
      {phase === 'chase' && (
        <div
          className="chase__mote"
          ref={moteRef}
          onClick={handleClick}
          role="button"
          aria-label="开启灵感之光"
          title={settled ? '点击光点，开启灵感之光' : undefined}
        >
          <div
            className="chase__aura"
            style={{
              width: settled ? 300 : 180,
              height: settled ? 300 : 180,
              transition: 'width .9s cubic-bezier(.2,.9,.24,1), height .9s cubic-bezier(.2,.9,.24,1)',
            }}
          />
          <div
            className="chase__core"
            style={{
              width: settled ? 12 : 8,
              height: settled ? 12 : 8,
              margin: settled ? '-6px 0 0 -6px' : '-4px 0 0 -4px',
              transition: 'width .8s cubic-bezier(.2,.9,.24,1), height .8s cubic-bezier(.2,.9,.24,1)',
            }}
          />

          {/* 定格后开始发晕 */}
          {settled && (
            <>
              <span className="chase__halo" />
              <span className="chase__halo chase__halo--b" />
              <span className="chase__halo chase__halo--c" />
            </>
          )}
        </div>
      )}

      {!settled && <p className="chase__hint">移动光标 · 追随微光</p>}

      {settled && phase === 'chase' && (
        <p className="chase__cta">点击光点，开启灵感之光</p>
      )}

      {/* 光晕转场：边缘始终柔和，放大铺满后又以光晕的形式收缩消散 */}
      {(phase === 'burst' || phase === 'dissolve') && (
        <div className="chase__flash" data-phase={phase} />
      )}
    </div>
  );
}
