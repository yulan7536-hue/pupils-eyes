import { useState } from 'react';
import { storySound } from '../utils/sound';

interface VineDoorProps {
  onZoomThrough: () => void;
}

export default function VineDoor({ onZoomThrough }: VineDoorProps) {
  const [isZooming, setIsZooming] = useState(false);
  const [isEyeHovered, setIsEyeHovered] = useState(false);

  const handleEyeClick = () => {
    if (isZooming) return;
    setIsZooming(true);
    storySound.playChime();
    setTimeout(() => {
      onZoomThrough();
    }, 1100);
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#1A3320] flex items-center justify-center overflow-hidden select-none">
      
      {/* 纯自然植物交织编织的藤蔓大门背景 */}
      <div 
        className={`relative w-full h-full flex items-center justify-center transition-all duration-1000 ease-in-out ${
          isZooming ? 'scale-[25] opacity-0 blur-md' : 'scale-100 opacity-100'
        }`}
      >
        {/* 背景层：密林与深绿苔藓 */}
        <div className="absolute inset-0 bg-radial from-[#2D4A34] via-[#1A3320] to-[#0E1C12]" />

        {/* 纯植物编制的左侧与右侧藤蔓叶片门扇（无任何木头或金属！） */}
        <svg 
          viewBox="0 0 1000 800" 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          preserveAspectRatio="none"
        >
          <defs>
            {/* 暖金色晨光滤镜 */}
            <linearGradient id="goldenLight" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFDE59" stopOpacity="0" />
              <stop offset="45%" stopColor="#FFDE59" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#FFF8D6" stopOpacity="1" />
              <stop offset="55%" stopColor="#FFDE59" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FFDE59" stopOpacity="0" />
            </linearGradient>

            {/* 嫩叶渐变 */}
            <linearGradient id="leafGrad1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#85A98F" />
              <stop offset="100%" stopColor="#2D4A34" />
            </linearGradient>
            <linearGradient id="leafGrad2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A3C9A8" />
              <stop offset="100%" stopColor="#1A3320" />
            </linearGradient>
          </defs>

          {/* 错综复杂的藤蔓主枝干体系 */}
          {/* 左侧门扇攀缘植物 */}
          <g stroke="#16291B" fill="none" strokeWidth="14" strokeLinecap="round">
            <path d="M-50,0 Q200,200 480,380" />
            <path d="M-20,400 Q250,300 475,410" />
            <path d="M0,850 Q220,600 480,430" />
            <path d="M120,-30 Q300,320 482,400" strokeWidth="8" />
            <path d="M80,820 Q320,500 478,415" strokeWidth="10" />
          </g>

          {/* 右侧门扇攀缘植物 */}
          <g stroke="#16291B" fill="none" strokeWidth="14" strokeLinecap="round">
            <path d="M1050,0 Q800,200 520,380" />
            <path d="M1020,400 Q750,300 525,410" />
            <path d="M1000,850 Q780,600 520,430" />
            <path d="M880,-30 Q700,320 518,400" strokeWidth="8" />
            <path d="M920,820 Q680,500 522,415" strokeWidth="10" />
          </g>

          {/* 门缝交界处透出的垂直暖金色强光束 */}
          <rect x="475" y="0" width="50" height="800" fill="url(#goldenLight)" opacity="0.85" />

          {/* 遍布门扇的繁茂手绘绿叶与藤蔓小花 */}
          {Array.from({ length: 65 }).map((_, i) => {
            const side = i % 2 === 0 ? 1 : -1;
            const seedX = side === 1 ? 500 - (i * 7) % 450 : 500 + (i * 7) % 450;
            const seedY = (i * 13) % 780;
            const scale = 0.6 + (i % 5) * 0.15;
            const rot = (i * 47) % 360;

            return (
              <g 
                key={i} 
                transform={`translate(${seedX}, ${seedY}) rotate(${rot}) scale(${scale})`}
                opacity={0.88}
              >
                {/* 椭圆叶片 */}
                <path 
                  d="M0,0 Q25,-15 50,0 Q25,15 0,0" 
                  fill={i % 3 === 0 ? 'url(#leafGrad1)' : 'url(#leafGrad2)'}
                  stroke="#16291B"
                  strokeWidth="1.5"
                />
                {/* 叶脉 */}
                <line x1="0" y1="0" x2="42" y2="0" stroke="#1A3320" strokeWidth="1" opacity="0.6" />
              </g>
            );
          })}
        </svg>

        {/* 缝隙中央：充满好奇与灵性的小孩眼睛 */}
        <div 
          onClick={handleEyeClick}
          onMouseEnter={() => {
            setIsEyeHovered(true);
            storySound.playPaperTurn();
          }}
          onMouseLeave={() => setIsEyeHovered(false)}
          className="relative z-20 cursor-pointer flex flex-col items-center group"
          role="button"
          tabIndex={0}
          aria-label="点击眼睛穿透星体"
          onKeyDown={(e) => e.key === 'Enter' && handleEyeClick()}
        >
          {/* 金色光晕扩散 */}
          <div className="absolute -inset-10 bg-radial from-[#FFDE59]/60 via-[#FFDE59]/20 to-transparent blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />

          {/* 手绘眼睛外框（定格泥塑与剪纸质感） */}
          <div className="relative w-28 h-18 bg-[#FAF7EE] hand-drawn-border hand-drawn-box flex items-center justify-center shadow-2xl overflow-hidden group-hover:scale-105 transition-transform duration-300">
            {/* 上下眼睑纸质阴影 */}
            <div className="absolute inset-0 border-t-4 border-b-4 border-[#1A3320]/30 pointer-events-none" />

            {/* 灵动的眼球瞳孔 */}
            <div 
              className={`w-10 h-10 rounded-full bg-[#1A3320] flex items-center justify-center transition-all duration-300 ${
                isEyeHovered ? 'scale-110 translate-y-[-1px]' : 'scale-100'
              }`}
            >
              {/* 瞳孔内的星光高光（两颗反射光点） */}
              <div className="w-3.5 h-3.5 rounded-full bg-white -translate-y-1 translate-x-1 shadow-sm" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFDE59] translate-y-1.5 -translate-x-1.5" />
            </div>

            {/* 纸质睫毛线 */}
            <div className="absolute top-1 left-4 w-2 h-1 bg-[#1A3320] rotate-[-25deg]" />
            <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-2 h-1 bg-[#1A3320]" />
            <div className="absolute top-1 right-4 w-2 h-1 bg-[#1A3320] rotate-[25deg]" />
          </div>

          {/* 手写指示词：“点击眼睛” */}
          <div className="mt-5 px-4 py-1.5 bg-[#FAF7EE] border border-[#1A3320] rounded-full text-xs md:text-sm font-bold text-[#1A3320] hand-drawn-box flex items-center gap-2 group-hover:bg-[#85A98F] group-hover:text-white transition-all">
            <span>✨</span>
            <span className="tracking-widest font-handwriting">轻触眼睛 · 穿透视界</span>
          </div>
        </div>

      </div>

      {/* 渐入全屏强光转场白场 */}
      <div 
        className={`fixed inset-0 pointer-events-none bg-[#F3F7F0] transition-opacity duration-700 ${
          isZooming ? 'opacity-100' : 'opacity-0'
        }`} 
      />

    </div>
  );
}
