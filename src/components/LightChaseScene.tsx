import { useEffect, useRef, useState } from 'react';
import { storySound } from '../utils/sound';

interface LightChaseSceneProps {
  onComplete: () => void;
}

export default function LightChaseScene({ onComplete }: LightChaseSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 光点坐标 (绝对像素)
  const [lightPos, setLightPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    return { x: 500, y: 350 };
  });

  // 交互状态
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [chaseAccumulatedTime, setChaseAccumulatedTime] = useState<number>(0);
  const [isExpanding, setIsExpanding] = useState<boolean>(false);
  const [isWhiteFadeOut, setIsWhiteFadeOut] = useState<boolean>(false);

  // 内部追光物理计算引用
  const lightPosRef = useRef({ x: 0, y: 0 });
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const chaseTimeRef = useRef(0);
  const isLockedRef = useRef(false);
  const lastTimeRef = useRef(performance.now());
  const velocityRef = useRef({ vx: 0, vy: 0 });

  useEffect(() => {
    const initX = window.innerWidth / 2;
    const initY = window.innerHeight / 2;
    lightPosRef.current = { x: initX, y: initY };
    prevMouseRef.current = { x: initX, y: initY };
    setLightPos({ x: initX, y: initY });

    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      const mouseX = e.clientX;
      const mouseY = e.clientY;

      const mouseDx = mouseX - prevMouseRef.current.x;
      const mouseDy = mouseY - prevMouseRef.current.y;
      const mouseSpeed = Math.hypot(mouseDx, mouseDy);
      prevMouseRef.current = { x: mouseX, y: mouseY };

      if (isLockedRef.current) return;

      // 计算鼠标到光点的向量与距离
      const curLight = lightPosRef.current;
      const dx = curLight.x - mouseX;
      const dy = curLight.y - mouseY;
      const dist = Math.hypot(dx, dy);

      // 追光计时累计：当用户鼠标在移动，且试图接近或跟随光点时累加
      if (mouseSpeed > 1.5) {
        chaseTimeRef.current += dt * 1.25;
        setChaseAccumulatedTime(chaseTimeRef.current);

        // 达到 2.5 秒：光点定格稳住
        if (chaseTimeRef.current >= 2.5) {
          isLockedRef.current = true;
          setIsLocked(true);
          storySound.playChime();
          velocityRef.current = { vx: 0, vy: 0 };
          return;
        }

        // 光点逃逸逻辑：以“比鼠标稍快一点的速度”在屏幕内游走逃逸
        const escapeRadius = 280;
        if (dist < escapeRadius) {
          // 远离鼠标的方向
          const angle = Math.atan2(dy, dx);
          // 附带微小的螺旋轻盈偏角，模拟灵动光子
          const swirlAngle = angle + (Math.sin(now * 0.005) * 0.4);
          const fleeSpeed = Math.max(mouseSpeed * 1.35, 6);

          velocityRef.current.vx = Math.cos(swirlAngle) * fleeSpeed;
          velocityRef.current.vy = Math.sin(swirlAngle) * fleeSpeed;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 物理平滑移动主循环
    let animId = 0;
    const updatePhysics = () => {
      if (!isLockedRef.current) {
        // 速度衰减阻尼
        velocityRef.current.vx *= 0.92;
        velocityRef.current.vy *= 0.92;

        let nextX = lightPosRef.current.x + velocityRef.current.vx;
        let nextY = lightPosRef.current.y + velocityRef.current.vy;

        // 边界弹性回弹，确保绝不会逃出屏幕边缘
        const padX = Math.max(80, window.innerWidth * 0.12);
        const padY = Math.max(80, window.innerHeight * 0.12);
        const maxX = window.innerWidth - padX;
        const maxY = window.innerHeight - padY;

        if (nextX < padX) {
          nextX = padX;
          velocityRef.current.vx = Math.abs(velocityRef.current.vx) * 0.8 + 4;
        } else if (nextX > maxX) {
          nextX = maxX;
          velocityRef.current.vx = -Math.abs(velocityRef.current.vx) * 0.8 - 4;
        }

        if (nextY < padY) {
          nextY = padY;
          velocityRef.current.vy = Math.abs(velocityRef.current.vy) * 0.8 + 4;
        } else if (nextY > maxY) {
          nextY = maxY;
          velocityRef.current.vy = -Math.abs(velocityRef.current.vy) * 0.8 - 4;
        }

        lightPosRef.current = { x: nextX, y: nextY };
        setLightPos({ x: nextX, y: nextY });
      }

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  // 点击灵感之光：触发白光全屏扩散转场
  const handleLightClick = () => {
    if (!isLocked || isExpanding) return;

    storySound.playLightSparkle();
    setIsExpanding(true);

    // 白光铺满全屏后收束退去，转入主场景
    setTimeout(() => {
      setIsWhiteFadeOut(true);
    }, 700);

    setTimeout(() => {
      onComplete();
    }, 1300);
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 bg-[#000000] flex items-center justify-center overflow-hidden select-none cursor-default"
      style={{ backgroundColor: '#000000' }}
    >
      {/* 极暗星尘微粒背景 */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-white rounded-full animate-ping" />
        <div className="absolute top-3/4 left-2/3 w-1.5 h-1.5 bg-white/70 rounded-full animate-pulse" />
      </div>

      {/* 
        灵感之光发光光点 
        鼠标静止则静止，鼠标靠近以稍快速度逃逸；2.5秒后定格稳住
      */}
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
        style={{
          left: `${lightPos.x}px`,
          top: `${lightPos.y}px`,
        }}
      >
        {/* 点击感应区域 */}
        <div
          onClick={handleLightClick}
          className={`relative flex items-center justify-center ${
            isLocked ? 'cursor-pointer p-8' : 'pointer-events-none p-4'
          }`}
        >
          {/* 最外层发光辉光晕染圈 */}
          <div
            className={`absolute rounded-full transition-all duration-500 ${
              isLocked
                ? 'w-32 h-32 bg-white/35 blur-xl animate-pulse scale-110'
                : 'w-24 h-24 bg-white/25 blur-lg'
            }`}
          />

          {/* 次级明亮光环 */}
          <div
            className={`absolute rounded-full transition-all duration-300 ${
              isLocked
                ? 'w-16 h-16 bg-white/60 blur-md'
                : 'w-12 h-12 bg-white/40 blur-sm'
            }`}
          />

          {/* 核心耀眼光点 */}
          <div
            className={`relative rounded-full bg-white transition-all duration-300 ${
              isLocked
                ? 'w-5 h-5 shadow-[0_0_24px_#ffffff,0_0_40px_#ffffff]'
                : 'w-3.5 h-3.5 shadow-[0_0_15px_#ffffff]'
            }`}
          />

          {/* 处于稳住定格状态时的光芒四射十字芒刺 */}
          {isLocked && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-0.5 bg-white/80 blur-[0.5px] rounded-full animate-pulse" />
              <div className="h-16 w-0.5 bg-white/80 blur-[0.5px] rounded-full animate-pulse absolute" />
            </div>
          )}
        </div>

        {/* 
          提示文字：光点停稳后，浮现一行白色发光的楷体字：“点击灵感之光”
        */}
        {isLocked && (
          <div
            onClick={handleLightClick}
            className="absolute top-14 left-1/2 -translate-x-1/2 whitespace-nowrap cursor-pointer animate-in fade-in zoom-in-95 duration-700"
          >
            <p
              className="text-lg md:text-xl font-medium tracking-widest text-white select-none"
              style={{
                fontFamily: "'STKaiti', 'KaiTi', '楷体', 'Ma Shan Zheng', 'Noto Serif SC', serif",
                textShadow:
                  '0 0 10px rgba(255,255,255,1), 0 0 20px rgba(255,255,255,0.85), 0 0 35px rgba(255,255,255,0.6)',
              }}
            >
              点击灵感之光
            </p>
          </div>
        )}
      </div>

      {/* 
        白光转场动效：
        用户点击该光点后，光点迅速放大、亮度增强直至铺满全屏（全屏白光），随后光芒收束退去，转场进入主场景“魔法草坪”
      */}
      {isExpanding && (
        <div
          className={`fixed inset-0 z-50 pointer-events-none bg-white transition-opacity duration-700 ${
            isWhiteFadeOut ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            animation: !isWhiteFadeOut ? 'flashExpand 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards' : undefined,
          }}
        />
      )}

      {/* 追光阶段无打扰的微引导（光点未锁定前） */}
      {!isLocked && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center pointer-events-none opacity-40 text-white text-xs font-mono tracking-widest">
          移动鼠标追随微光...
        </div>
      )}

      <style>{`
        @keyframes flashExpand {
          0% {
            opacity: 0;
            clip-path: circle(20px at ${lightPos.x}px ${lightPos.y}px);
          }
          50% {
            opacity: 0.95;
            clip-path: circle(40vw at ${lightPos.x}px ${lightPos.y}px);
          }
          100% {
            opacity: 1;
            clip-path: circle(150vw at ${lightPos.x}px ${lightPos.y}px);
          }
        }
      `}</style>
    </div>
  );
}
