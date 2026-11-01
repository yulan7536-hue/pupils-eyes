import { useEffect, useRef } from 'react';

/**
 * 极轻微的 3D 鼠标跟随倾斜：让卡片像一张拿在手里、会随视角转动的立体绘本卡。
 * 约束：
 * - 触屏（hover: none）不启用，手指滑动时倾斜只会碍事；
 * - 系统开启「减少动态效果」时不启用；
 * - 幅度默认 2°，超过 3° 就会有眩晕感，且会和卡片阴影打架。
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(maxDeg = 2) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;

    let raf = 0;
    let active = false;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      // 只在小范围内跟随：移出卡片边缘后不再继续放大角度
      const rx = Math.max(-1, Math.min(1, -py)) * maxDeg;
      const ry = Math.max(-1, Math.min(1, px)) * maxDeg;
      active = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      });
    };

    const reset = () => {
      if (!active) return;
      active = false;
      cancelAnimationFrame(raf);
      el.style.transform = '';
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset);
    el.addEventListener('pointercancel', reset);

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
      el.removeEventListener('pointercancel', reset);
      cancelAnimationFrame(raf);
      el.style.transform = '';
    };
  }, [maxDeg]);

  return ref;
}
