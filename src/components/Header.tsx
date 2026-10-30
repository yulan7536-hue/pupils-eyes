import { Sparkles, Volume2, VolumeX, BookOpen, Globe2 } from 'lucide-react';

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
    <header className="sticky top-0 z-30 w-full bg-[#FAF5E8]/95 backdrop-blur-xs border-b-2 border-[#1E3824] shadow-xs select-none">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-6">
        
        {/* Zone 1: Brand title wordmark with clay emblem */}
        <a 
          href="#" 
          onClick={(e) => {
            e.preventDefault();
            onScrollToExplore();
          }}
          className="text-base md:text-lg font-bold tracking-tight text-[#1E3824] whitespace-nowrap shrink-0 flex items-center gap-2.5 group"
        >
          <span className="w-8 h-8 rounded-full bg-[#6E9277] border-2 border-[#1E3824] flex items-center justify-center text-white text-base shadow-xs group-hover:rotate-12 transition-transform">
            🌱
          </span>
          <div className="flex flex-col">
            <span className="font-serif font-black text-sm md:text-base leading-tight">童眼看世界</span>
            <span className="text-[10px] text-[#52796F] font-sans font-bold -mt-0.5">小王子定格黏土星体</span>
          </div>
        </a>

        {/* Zone 2: 4 nav links, single line */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-bold text-[#52796F]">
          <button 
            type="button"
            onClick={onScrollToExplore}
            className="hover:text-[#1E3824] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-[#EAEFE6]"
          >
            <Globe2 size={15} className="text-[#6E9277]" />
            <span>3D黏土星体 ({pinCount}个点位)</span>
          </button>

          <button 
            type="button"
            onClick={onScrollToGallery}
            className="hover:text-[#1E3824] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-[#EAEFE6]"
          >
            <BookOpen size={15} className="text-[#6E9277]" />
            <span>秘密花园画卷</span>
          </button>

          <button 
            type="button"
            onClick={onToggleSound}
            className="hover:text-[#1E3824] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-[#EAEFE6]"
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-[#6E9277]" />}
            <span>{isMuted ? '静音' : '八音盒音效'}</span>
          </button>
        </nav>

        {/* Zone 3: 1 primary action with clay button finish */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCreate}
            className="clay-btn px-4 md:px-5 py-2 text-xs md:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sparkles size={14} className="text-[#E6B84A]" />
            <span>创建课题 / 上传成果</span>
          </button>
        </div>

      </div>
    </header>
  );
}
