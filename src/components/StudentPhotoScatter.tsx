import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GalleryItem } from './GalleryWall';
import { storySound } from '../utils/sound';
import { Camera, Sparkles, X, RotateCcw, MapPin } from 'lucide-react';

interface StudentPhotoScatterProps {
  items: GalleryItem[];
  onSelectWork: (work: GalleryItem) => void;
}

export default function StudentPhotoScatter({
  items,
  onSelectWork,
}: StudentPhotoScatterProps) {
  const [isScatterOpen, setIsScatterOpen] = useState(false);
  const studentWorks = items.filter((item) => item.role === 'STUDENT');

  // 为每张照片预先计算具有物理自然感的散落参数 (随机坐标偏移、抛物弧度、倾斜旋转角度)
  const scatterPositions = useMemo(() => {
    return studentWorks.map((_, index) => {
      // 围绕中心呈多圈螺旋/椭圆散落
      const total = studentWorks.length;
      const angle = (index / total) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
      const distance = 160 + (index % 3) * 110 + Math.random() * 60;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * (distance * 0.75);
      const rotate = Math.floor(Math.random() * 40 - 20); // -20deg 到 +20deg
      return { x, y, rotate };
    });
  }, [studentWorks]);

  const handleOpenScatter = () => {
    storySound.playChime();
    storySound.playPinDrop();
    setIsScatterOpen(true);
  };

  const handleCloseScatter = () => {
    storySound.playPaperTurn();
    setIsScatterOpen(false);
  };

  return (
    <>
      {/* 
        课桌右侧：散落的拍立得照片夹
        微交互：鼠标悬停带有类似钟摆的物理惯性微微浮动，并带有柔和的高光描边
      */}
      <motion.div
        whileHover={{
          rotate: [1.5, -2, 1, 0],
          y: -6,
          transition: { duration: 0.8, repeat: Infinity, repeatType: 'reverse' },
        }}
        className="relative group cursor-pointer select-none"
        onClick={handleOpenScatter}
      >
        {/* 柔和高光描边光晕 (Hover Glow) */}
        <div className="absolute -inset-2.5 rounded-2xl bg-[#FFE066]/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* 
          【课桌右侧：厚重的精装相册】
          四个角有铁片/金属包角装饰，封面上写着《学生成果展示》
        */}
        <div className="relative w-44 sm:w-52 h-56 sm:h-64 bg-gradient-to-br from-[#1A3827] via-[#234A34] to-[#0F2419] rounded-r-2xl rounded-l-md shadow-2xl p-4 flex flex-col justify-between border-l-8 border-[#0C1A12] overflow-hidden">
          
          {/* 四个角的铁片/金属包角装饰 (Metal Corner Protectors with Rivets) */}
          {/* 左上角金属包角 */}
          <div className="absolute top-0 left-0 w-8 h-8 pointer-events-none">
            <svg viewBox="0 0 32 32" className="w-full h-full text-[#D4AF37] drop-shadow-sm">
              <path d="M0,0 L32,0 L12,12 L0,32 Z" fill="#C5A059" stroke="#E5C158" strokeWidth="1" />
              <circle cx="8" cy="8" r="2" fill="#5D4037" />
            </svg>
          </div>

          {/* 右上角金属包角 */}
          <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none">
            <svg viewBox="0 0 32 32" className="w-full h-full text-[#D4AF37] drop-shadow-sm">
              <path d="M32,0 L0,0 L20,12 L32,32 Z" fill="#C5A059" stroke="#E5C158" strokeWidth="1" />
              <circle cx="24" cy="8" r="2" fill="#5D4037" />
            </svg>
          </div>

          {/* 左下角金属包角 */}
          <div className="absolute bottom-0 left-0 w-8 h-8 pointer-events-none">
            <svg viewBox="0 0 32 32" className="w-full h-full text-[#D4AF37] drop-shadow-sm">
              <path d="M0,32 L32,32 L12,20 L0,0 Z" fill="#C5A059" stroke="#E5C158" strokeWidth="1" />
              <circle cx="8" cy="24" r="2" fill="#5D4037" />
            </svg>
          </div>

          {/* 右下角金属包角 */}
          <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none">
            <svg viewBox="0 0 32 32" className="w-full h-full text-[#D4AF37] drop-shadow-sm">
              <path d="M32,32 L0,32 L20,20 L32,0 Z" fill="#C5A059" stroke="#E5C158" strokeWidth="1" />
              <circle cx="24" cy="24" r="2" fill="#5D4037" />
            </svg>
          </div>

          {/* 相册右边缘厚重纸张切边 */}
          <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-gradient-to-l from-[#FFF8E7] to-[#E3DAC9] opacity-90 border-l border-[#1A3827]" />
          
          {/* 金色书脊缎带 */}
          <div className="absolute top-0 right-10 w-3.5 h-14 bg-[#F1C40F] shadow-xs transform origin-top group-hover:rotate-6 transition-transform" />

          {/* 封面标题：《学生成果展示》 */}
          <div className="z-10 pt-3 px-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#FFE875] opacity-90 block mb-1">
              STUDENT SHOWCASE
            </span>
            <h3 className="font-serif font-black text-xl sm:text-2xl text-[#FFFEEA] leading-snug tracking-wider drop-shadow-sm">
              《学生成果<br />展示》
            </h3>
            <span className="text-[11px] text-[#A3E4D7] mt-2 block font-serif">
              精装相册 · {studentWorks.length} 份成果
            </span>
          </div>

          {/* 相册封底下沿 */}
          <div className="z-10 flex items-center justify-between text-xs text-white pt-2 border-t border-white/20">
            <span className="font-bold flex items-center gap-1.5 text-[11px]">
              <Camera size={14} className="text-[#FFE066]" />
              <span>翻开相册</span>
            </span>
            <span className="text-sm group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </div>

        {/* 实物下方手绘指示牌 */}
        <div className="text-center mt-3">
          <span className="font-serif font-bold text-xs text-[#122818] tracking-wider block">
            📗 《学生成果展示》
          </span>
          <span className="text-[10px] text-[#3B6647] font-mono">金属包角精装相册</span>
        </div>
      </motion.div>

      {/* 
        【阶段三：物理散落动效 (Scatter Effect)】
        点击“拍立得照片夹”时，几十张学生成果照片“嘭”地一下从中心弹起，向屏幕四周散开（带有随机旋转角度和抛物线物理轨迹），最终随意但清晰地铺在屏幕表面供人挑选。
      */}
      <AnimatePresence>
        {isScatterOpen && (
          <div className="fixed inset-0 z-50 bg-[#122818]/60 backdrop-blur-md flex items-center justify-center overflow-hidden p-4 select-none">
            
            {/* 顶部悬浮控制栏 */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white/95 backdrop-blur-md px-6 py-2.5 rounded-full shadow-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-[#122818]">
                <Camera size={16} className="text-[#2F6B3F]" />
                <span>已翻开《学生成果展示》精装相册 · {studentWorks.length} 份成果</span>
              </div>
              
              <button
                type="button"
                onClick={handleCloseScatter}
                className="clay-btn px-4 py-1 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>合上相册</span>
              </button>
            </div>

            {/* 
              散落舞台中心：每张拍立得带有初速度、抛物线轨迹和弹簧惯性散开
            */}
            <div className="relative w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center">
              {studentWorks.map((work, index) => {
                const pos = scatterPositions[index] || { x: 0, y: 0, rotate: 0 };

                return (
                  <motion.div
                    key={work.id}
                    initial={{ x: 0, y: 0, scale: 0.2, rotate: 0, opacity: 0 }}
                    animate={{
                      x: pos.x,
                      y: pos.y,
                      scale: 1,
                      rotate: pos.rotate,
                      opacity: 1,
                    }}
                    exit={{ x: 0, y: 0, scale: 0.2, rotate: 0, opacity: 0 }}
                    transition={{
                      type: 'spring',
                      damping: 14,
                      stiffness: 160,
                      delay: index * 0.04,
                    }}
                    whileHover={{
                      scale: 1.18,
                      zIndex: 40,
                      rotate: 0,
                      boxShadow: '0 25px 35px -5px rgba(0,0,0,0.3)',
                      transition: { duration: 0.2 },
                    }}
                    onClick={() => {
                      storySound.playPinDrop();
                      onSelectWork(work);
                    }}
                    className="absolute w-44 sm:w-52 bg-[#FAF9F5] p-3 rounded-xl shadow-lg border border-[#1E3824]/15 cursor-pointer group flex flex-col justify-between"
                  >
                    {/* 照片缩略图 */}
                    <div className="w-full h-32 sm:h-36 bg-[#E8EFE5] rounded-lg overflow-hidden relative mb-2">
                      {work.imageUrl ? (
                        <img
                          src={work.imageUrl}
                          alt={work.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#245C33]">
                          <span className="text-3xl">🌱</span>
                          <span className="text-[10px] font-bold mt-1">学生手作</span>
                        </div>
                      )}

                      {/* 地区浮标 */}
                      <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-xs text-[9px] font-bold text-[#1E3824] flex items-center gap-1">
                        <MapPin size={9} />
                        <span>{work.province}</span>
                      </div>
                    </div>

                    {/* 相纸手写签名区 */}
                    <div className="text-left">
                      <h4 className="font-handwriting text-sm text-[#122818] font-bold leading-tight line-clamp-1 mb-1">
                        {work.title}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] text-[#3B6647]">
                        <span className="font-medium font-serif">{work.author}</span>
                        <span className="font-mono opacity-70">{work.date}</span>
                      </div>
                    </div>

                    {/* 悬停微光提示 */}
                    <div className="mt-2 pt-1 border-t border-stone-200 text-center text-[10px] text-[#2F6B3F] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>✨ 轻触 3D 立体立起</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* 散落背景点击空白处收拢 */}
            <div
              className="absolute inset-0 -z-10"
              onClick={handleCloseScatter}
            />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
