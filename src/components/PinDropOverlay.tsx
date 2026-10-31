import { useEffect, useState } from 'react';
import { storySound } from '../utils/sound';

interface PinDropOverlayProps {
  locationName: string;
  onComplete: () => void;
}

export default function PinDropOverlay({ locationName, onComplete }: PinDropOverlayProps) {
  const [phase, setPhase] = useState<'FALLING' | 'IMPACT' | 'SETTLED'>('FALLING');

  useEffect(() => {
    // 1. 0.35秒：图钉急速下落撞击
    const timer1 = setTimeout(() => {
      setPhase('IMPACT');
      storySound.playPinSnap();
    }, 380);

    // 2. 0.75秒：震荡回弹波平息
    const timer2 = setTimeout(() => {
      setPhase('SETTLED');
    }, 850);

    // 3. 1.05秒：动画结束，立刻弹出身份选择
    const timer3 = setTimeout(() => {
      onComplete();
    }, 1100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden select-none">
      
      {/* 聚焦落钉坐标光芒 */}
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px] transition-opacity duration-300" />

      {/* 动画主体容器 */}
      <div className="relative flex flex-col items-center justify-center">
        
        {/* 撞击时的金黄软陶震荡光圈 */}
        {phase !== 'FALLING' && (
          <div className="absolute w-44 h-44 rounded-full border-4 border-[#F5B041] animate-ping opacity-75" />
        )}
        {phase !== 'FALLING' && (
          <div className="absolute w-28 h-28 rounded-full bg-[#E67E22]/30 blur-md animate-pulse" />
        )}

        {/* 
          急速从上方落下的实体软陶图钉
          “啪”地一下钉入
        */}
        <div
          className={`relative z-10 flex flex-col items-center transition-all duration-300 ${
            phase === 'FALLING'
              ? '-translate-y-96 scale-125 opacity-70'
              : phase === 'IMPACT'
              ? 'translate-y-0 scale-95 opacity-100 rotate-3'
              : 'translate-y-0 scale-100 opacity-100 rotate-0'
          }`}
          style={{
            transitionTimingFunction: phase === 'FALLING' ? 'cubic-bezier(0.55, 0.055, 0.675, 0.19)' : 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
        >
          {/* 图钉大圆头 (红陶色手捏泥丸) */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E67E22] via-[#D35400] to-[#A04000] shadow-2xl flex items-center justify-center border border-white/40">
            <div className="w-4 h-4 rounded-full bg-white/40 blur-[1px] -translate-x-1.5 -translate-y-1.5" />
          </div>

          {/* 图钉金属/细竹针尖 */}
          <div className="w-1.5 h-10 bg-gradient-to-b from-[#7F8C8D] to-[#2C3E50] rounded-b-full shadow-md -mt-1" />

          {/* 地面黏土底座 */}
          <div className="w-10 h-3 bg-[#27AE60]/60 rounded-full blur-[2px] -mt-1" />
        </div>

        {/* “啪！”敲击文字特效 */}
        {phase === 'IMPACT' && (
          <div className="absolute -top-12 animate-in zoom-in-50 duration-150 font-black text-2xl text-[#FFE066] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] font-serif tracking-widest">
            啪！
          </div>
        )}

        {/* 钉入地点标牌 */}
        <div className="mt-8 px-4 py-1.5 rounded-full bg-[#FAFBF8]/95 backdrop-blur-md shadow-xl border border-[#1E3824]/15 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="text-base">📍</span>
          <span className="font-serif font-black text-xs md:text-sm text-[#122818]">
            已定格坐标：童眼看 {locationName.split('·').pop()}
          </span>
        </div>
      </div>
    </div>
  );
}
