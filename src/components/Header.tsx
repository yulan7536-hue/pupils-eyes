import { Sparkles, Volume2, VolumeX, BookOpen, Globe2, Leaf } from 'lucide-react';
import { storySound } from '../utils/sound';

interface HeaderProps {
  onOpenCreate: () => void;
  onScrollToExplore: () => void;
  onScrollToGallery: () => void;
  isMuted: boolean;
  onToggleSound: () => void;
  pinCount: number;
}

export default function Header({
  onOpenCreate,
  onScrollToExplore,
  onScrollToGallery,
  isMuted,
  onToggleSound,
  pinCount,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full parchment-sheet border-b border-[#1A3320]/20 select-none">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3.5 flex items-center justify-between gap-8">
        
        {/* Zone 1: Brand title, one line */}
        <a 
          href="#" 
          onClick={(e) => {
            e.preventDefault();
            onScrollToExplore();
          }}
          className="text-base md:text-lg font-bold tracking-tight text-[#1A3320] whitespace-nowrap shrink-0 flex items-center gap-2 group"
        >
          <span className="text-xl group-hover:rotate-12 transition-transform">🌱</span>
          <span className="font-serif">童眼看世界 · 小王子泥塑星体</span>
        </a>

        {/* Zone 2: 4 nav links, single line */}
        <nav className="hidden md:flex items-center gap-6 text-xs md:text-sm font-semibold text-[#52796F]">
          <button 
            type="button"
            onClick={onScrollToExplore}
            className="hover:text-[#1A3320] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Globe2 size={14} className="text-[#85A98F]" />
            <span>3D星体 ({pinCount}个点位)</span>
          </button>

          <button 
            type="button"
            onClick={onScrollToGallery}
            className="hover:text-[#1A3320] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <BookOpen size={14} className="text-[#85A98F]" />
            <span>秘密花园画卷</span>
          </button>

          <button 
            type="button"
            onClick={onToggleSound}
            className="hover:text-[#1A3320] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} className="text-[#85A98F]" />}
            <span>{isMuted ? '静音' : '八音盒音效'}</span>
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCreate}
            className="px-4 md:px-5 py-2 text-xs md:text-sm font-bold text-white bg-[#85A98F] hover:bg-[#52796F] rounded-full hand-drawn-border hand-drawn-box hand-drawn-box-pressed transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Sparkles size={14} />
            <span>创建课题 / 上传成果</span>
          </button>
        </div>

      </div>
    </header>
  );
}
