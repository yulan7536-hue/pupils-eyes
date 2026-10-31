import { X, MapPin, Sparkles, BookOpen, User, Calendar, ExternalLink } from 'lucide-react';
import { PinItem } from './ClayGlobe';
import { storySound } from '../utils/sound';

interface PaperDetailModalProps {
  pin: PinItem | null;
  onClose: () => void;
  onNavigateToGallery?: (id: string) => void;
}

export default function PaperDetailModal({ pin, onClose, onNavigateToGallery }: PaperDetailModalProps) {
  if (!pin) return null;

  const handleClose = () => {
    storySound.playPaperTurn();
    onClose();
  };

  const handleGoGallery = () => {
    storySound.playPaperTurn();
    if (onNavigateToGallery) {
      onNavigateToGallery(pin.id);
    }
    onClose();
  };

  const isTeacher = pin.role === 'TEACHER';

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-end sm:items-center justify-end p-4 md:p-8 select-none">
      <div 
        className="pointer-events-auto relative w-full max-w-md clay-card p-6 md:p-7 text-[#1E3824] shadow-2xl animate-in slide-in-from-right duration-250"
      >
        {/* 顶部手捏软陶胶带 */}
        <div 
          className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 border-2 border-[#1E3824] text-xs font-black rounded-full shadow-xs -rotate-1 ${
            isTeacher ? 'bg-[#D47A6A] text-[#FAF5E8]' : 'bg-[#6E9277] text-[#FAF5E8]'
          }`}
        >
          🍃 童眼观察站 · 定格陶土档案
        </div>

        {/* 关闭按钮 */}
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-[#1E3824] hover:scale-110 p-1.5 rounded-full hover:bg-[#EAEFE6] transition-transform"
          aria-label="关闭详情"
        >
          <X size={20} />
        </button>

        <div className="mt-3 space-y-4">
          {/* 地点与学校 */}
          <div className="flex items-center gap-2 text-xs text-[#52796F] font-black border-b-2 border-[#1E3824]/15 pb-2.5">
            <MapPin size={15} className="text-[#6E9277]" />
            <span>{pin.city}</span>
            <span>·</span>
            <span>{pin.school}</span>
          </div>

          {/* 标题与身份 */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl md:text-2xl font-black tracking-wide leading-snug font-serif">
              {pin.name}
            </h3>
            <span 
              className={`shrink-0 px-3 py-1 border-2 border-[#1E3824] text-xs font-black rounded-full shadow-xs ${
                isTeacher ? 'bg-[#D47A6A] text-[#FAF5E8]' : 'bg-[#6E9277] text-[#FAF5E8]'
              }`}
            >
              {isTeacher ? '👨‍🏫 教师教研' : '👧 学生观察'}
            </span>
          </div>

          {/* 故事与内容摘录 */}
          <div className="p-4 bg-[#EAEFE6] rounded-xl border-2 border-[#1E3824]/30 text-xs md:text-sm leading-relaxed text-[#1E3824]/90 relative font-serif">
            <span className="text-2xl text-[#6E9277] absolute top-1 left-2 font-serif select-none">“</span>
            <p className="pl-4 italic">{pin.desc}</p>
            <span className="text-2xl text-[#6E9277] float-right font-serif select-none">”</span>
          </div>

          {/* 附加元信息 */}
          <div className="grid grid-cols-2 gap-2 text-xs text-[#52796F] font-bold pt-1">
            <div className="flex items-center gap-1.5">
              <User size={13} />
              <span>作者：{pin.author || '童眼自然探索者'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={13} />
              <span>收录：{pin.date || '近期实践'}</span>
            </div>
          </div>

          {/* 底部操作 */}
          <div className="flex items-center justify-between pt-3.5 border-t-2 border-[#1E3824]/15">
            <span className="text-xs text-[#52796F] font-bold flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#E6B84A]" />
              已定格在 3D 软陶星体表面
            </span>

            <button
              onClick={handleGoGallery}
              className="clay-btn px-4 py-2 text-xs font-black flex items-center gap-1.5"
            >
              <BookOpen size={14} />
              <span>翻阅画卷手记</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
