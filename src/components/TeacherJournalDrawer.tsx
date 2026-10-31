import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GalleryItem } from './GalleryWall';
import { storySound } from '../utils/sound';
import { BookOpen, Sparkles, MapPin, ChevronRight, X, Layers } from 'lucide-react';

interface TeacherJournalDrawerProps {
  items: GalleryItem[];
  onSelectWork: (work: GalleryItem) => void;
}

export default function TeacherJournalDrawer({
  items,
  onSelectWork,
}: TeacherJournalDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const teacherWorks = items.filter((item) => item.role === 'TEACHER');

  const handleToggle = () => {
    storySound.playPaperTurn();
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* 
        课桌左侧：一本厚厚的手账本（教案本）
        微交互：鼠标悬停带有类似钟摆的物理惯性微微浮动，并带有柔和的高光描边
      */}
      <motion.div
        whileHover={{
          rotate: [-1.2, 1.8, -0.8, 0],
          y: -6,
          transition: { duration: 0.8, repeat: Infinity, repeatType: 'reverse' },
        }}
        className="relative group cursor-pointer select-none"
        onClick={handleToggle}
      >
        {/* 柔和高光描边光晕 (Hover Glow) */}
        <div className="absolute -inset-2.5 rounded-2xl bg-[#D6634C]/25 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* 普通的红色笔记本（Notebook）封面实物造型 */}
        <div className="relative w-44 sm:w-52 h-56 sm:h-64 bg-gradient-to-br from-[#B3261E] via-[#C0392B] to-[#962018] rounded-r-2xl rounded-l-md shadow-2xl p-4 flex flex-col justify-between border-l-8 border-[#6B140E] overflow-hidden">
          
          {/* 红色笔记本边缘缝线与白卡夹层 */}
          <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-gradient-to-l from-[#FFFDE8] to-[#E8E2CD] opacity-90 border-l border-[#B3261E]" />
          
          {/* 笔记本黑色弹力绑带与黄色书签丝带 */}
          <div className="absolute top-0 right-10 w-3.5 h-16 bg-[#FFE066] shadow-xs transform origin-top group-hover:rotate-6 transition-transform" />
          <div className="absolute top-0 bottom-0 right-7 w-2.5 bg-[#4A100B]/40" />

          {/* 封面标题：《教案实录手账》 */}
          <div className="z-10 pt-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/70 block mb-1">
              TEACHING NOTEBOOK
            </span>
            <h3 className="font-serif font-black text-xl sm:text-2xl text-white leading-snug tracking-wider drop-shadow-sm">
              《教案实录<br />手账》
            </h3>
            <span className="text-[11px] text-white/80 mt-2 block font-serif">
              收录 {teacherWorks.length} 篇教学实录
            </span>
          </div>

          {/* 封底标牌 */}
          <div className="z-10 flex items-center justify-between text-xs text-white pt-2 border-t border-white/20">
            <span className="font-bold flex items-center gap-1.5 text-[11px]">
              <BookOpen size={14} className="text-[#FFE066]" />
              <span>翻开实录</span>
            </span>
            <span className="text-sm group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </div>

        {/* 实物下方手绘指示牌 */}
        <div className="text-center mt-3">
          <span className="font-serif font-bold text-xs text-[#122818] tracking-wider block">
            📕 《教案实录手账》
          </span>
          <span className="text-[10px] text-[#3B6647] font-mono">点击拉出分层教案卡</span>
        </div>
      </motion.div>

      {/* 
        【阶段三：抽屉式滑出动效】
        点击手账本时，不要弹窗。镜头对准手账本，里面的教案分类标签（如黑胶唱片一般）一张张带有错落感、带有弹簧惯性（Spring physics）向上滑出
      */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-40 bg-[#122818]/40 backdrop-blur-xs flex items-center justify-start p-4 sm:p-12 overflow-hidden">
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 200 }}
              className="relative w-full max-w-lg bg-[#FAFBF7] rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col max-h-[88vh]"
            >
              {/* 顶部收起工具栏 */}
              <div className="flex items-center justify-between pb-4 border-b border-[#1E3824]/10 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#D6634C] text-white flex items-center justify-center font-bold text-sm">
                    👨‍🏫
                  </div>
                  <div>
                    <h2 className="font-serif font-black text-lg text-[#122818]">
                      园丁手账 · 抽屉式分层教案
                    </h2>
                    <span className="text-[10px] text-[#3B6647] font-mono">
                      如唱片套一般层叠上滑 · 共 {teacherWorks.length} 份
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggle}
                  className="p-1.5 rounded-full hover:bg-stone-200 text-[#122818] cursor-pointer transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 
                如黑胶唱片一般，错落感向上滑出（Staggered Spring Physics）
              */}
              <div className="space-y-4 overflow-y-auto no-scrollbar pr-1 py-1">
                {teacherWorks.map((work, index) => (
                  <motion.div
                    key={work.id}
                    initial={{ y: 60 + index * 20, opacity: 0, rotate: -2 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    exit={{ y: 40, opacity: 0 }}
                    transition={{
                      type: 'spring',
                      damping: 18,
                      stiffness: 220,
                      delay: index * 0.08,
                    }}
                    whileHover={{
                      scale: 1.02,
                      x: 6,
                      boxShadow: '0 12px 24px -6px rgba(22, 46, 29, 0.15)',
                      transition: { duration: 0.15 },
                    }}
                    onClick={() => {
                      storySound.playPinDrop();
                      onSelectWork(work);
                    }}
                    className="p-4 sm:p-5 bg-white rounded-2xl border border-[#1E3824]/10 cursor-pointer shadow-xs relative overflow-hidden group"
                  >
                    {/* 左侧教案唱片套色彩书脊 */}
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#D6634C] group-hover:bg-[#E05338] transition-colors" />

                    <div className="pl-2">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-[#3B6647] font-bold flex items-center gap-1 font-mono text-[11px]">
                          <MapPin size={11} className="text-[#D6634C]" />
                          <span>{work.region}</span>
                        </span>
                        <span className="font-mono text-[10px] text-stone-400">
                          TAG #{String(index + 1).padStart(2, '0')}
                        </span>
                      </div>

                      <h4 className="font-serif font-black text-base text-[#122818] group-hover:text-[#D6634C] transition-colors leading-snug mb-2">
                        {work.title}
                      </h4>

                      <p className="text-xs text-[#122818]/80 line-clamp-2 font-serif leading-relaxed mb-3">
                        {work.content}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[11px] text-[#3B6647]">
                        <span className="font-medium">执教：{work.author} ({work.school})</span>
                        <span className="flex items-center gap-1 font-bold text-[#D6634C] group-hover:translate-x-1 transition-transform">
                          <span>展开立体书</span>
                          <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* 底部提示 */}
              <div className="mt-4 pt-3 border-t border-[#1E3824]/10 text-center text-xs text-[#3B6647] flex items-center justify-center gap-1.5">
                <Sparkles size={13} className="text-[#D6634C]" />
                <span>点击任意教案卡片，即可 3D 立体翻页并查看六维效度雷达图</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
