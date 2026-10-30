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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3320]/45 backdrop-blur-[2px]">
      <div 
        className="relative w-full max-w-lg parchment-sheet p-6 hand-drawn-border hand-drawn-box text-[#1A3320] rotate-[-0.5deg] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* 和纸胶带修饰 */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 bg-[#FAF3D1] border border-[#1A3320] text-[#1A3320] text-xs font-bold rotate-1 shadow-sm">
          🍃 童眼观察站 · 空间档案
        </div>

        {/* 关闭按钮 */}
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-[#1A3320] hover:scale-110 p-1 transition-transform"
          aria-label="关闭详情"
        >
          <X size={20} />
        </button>

        <div className="mt-3 space-y-4">
          {/* 地点与学校 */}
          <div className="flex items-center gap-2 text-xs text-[#52796F] font-semibold border-b border-[#1A3320]/15 pb-2">
            <MapPin size={14} className="text-[#85A98F]" />
            <span>{pin.city}</span>
            <span>·</span>
            <span>{pin.school}</span>
          </div>

          {/* 标题与身份 */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl font-bold tracking-wide leading-snug">
              {pin.name}
            </h3>
            <span className="shrink-0 px-2.5 py-1 bg-[#F3F7F0] border border-[#1A3320] text-xs font-bold rounded">
              {pin.role === 'TEACHER' ? '👨‍🏫 教师教研' : '👧 学生观察'}
            </span>
          </div>

          {/* 故事与内容摘录 */}
          <div className="p-4 bg-[#F3F7F0] hand-drawn-border-sm text-sm leading-relaxed text-[#1A3320]/90 relative">
            <span className="text-2xl text-[#85A98F] absolute top-1 left-2 font-serif select-none">“</span>
            <p className="pl-4 italic font-serif">{pin.desc}</p>
            <span className="text-2xl text-[#85A98F] float-right font-serif select-none">”</span>
          </div>

          {/* 附加元信息 */}
          <div className="grid grid-cols-2 gap-2 text-xs text-[#52796F] pt-1">
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
          <div className="flex items-center justify-between pt-3 border-t border-[#1A3320]/15">
            <span className="text-xs text-[#52796F] flex items-center gap-1">
              <Sparkles size={12} className="text-[#FFDE59]" />
              已插钉至 3D 泥塑星球
            </span>

            <button
              onClick={handleGoGallery}
              className="px-4 py-2 bg-[#85A98F] hover:bg-[#52796F] text-[#FAF7EE] text-xs font-bold rounded-full hand-drawn-border hand-drawn-box-sm flex items-center gap-1.5 transition-all"
            >
              <BookOpen size={13} />
              <span>翻阅作品画卷</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
