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
        className="pointer-events-auto relative w-full max-w-md bg-[#FAFBF8] rounded-2xl p-6 md:p-8 text-[#122818] animate-in slide-in-from-right duration-250"
      >
        {/* 顶部标签（纯文字色彩，无盒子） */}
        <div className="flex items-center justify-between mb-3">
          <span 
            className={`text-xs font-bold tracking-wider ${
              isTeacher ? 'text-[#D6634C]' : 'text-[#2F6B3F]'
            }`}
          >
            🍃 童眼观察站 · 定格档案
          </span>
          <button 
            onClick={handleClose}
            className="text-[#122818] hover:scale-110 p-1 rounded-full transition-transform cursor-pointer"
            aria-label="关闭详情"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* 地点与学校（纯文字留白） */}
          <div className="flex items-center gap-2 text-xs text-[#3B6647] font-bold">
            <MapPin size={15} className="text-[#327346]" />
            <span>{pin.city}</span>
            <span>·</span>
            <span>{pin.school}</span>
          </div>

          {/* 标题与身份 */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl md:text-2xl font-black tracking-wide leading-snug font-serif text-[#122818]">
              {pin.name}
            </h3>
            <span 
              className={`shrink-0 text-xs font-bold pt-1 ${
                isTeacher ? 'text-[#D6634C]' : 'text-[#2F6B3F]'
              }`}
            >
              {isTeacher ? '👨‍🏫 教师教研' : '👧 学生观察'}
            </span>
          </div>

          {/* 故事与内容摘录（纯文本自然段落，无灰色背景盒子与外框线） */}
          <div className="text-xs md:text-sm leading-relaxed text-[#122818]/90 font-serif italic pl-3 border-l-2 border-[#2F6B3F]/30 py-1">
            <p>{pin.desc}</p>
          </div>

          {/* 附加元信息 */}
          <div className="grid grid-cols-2 gap-2 text-xs text-[#3B6647] font-bold pt-1">
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
          <div className="flex items-center justify-between pt-4">
            <span className="text-xs text-[#3B6647] font-bold flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#2F6B3F]" />
              已定格在 3D 黏土星体
            </span>

            <button
              onClick={handleGoGallery}
              className="clay-btn px-4 py-2 text-xs font-bold flex items-center gap-1.5"
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
