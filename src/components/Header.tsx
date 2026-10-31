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
    <header className="sticky top-0 z-30 w-full bg-[#F5F8F2]/90 backdrop-blur-md select-none transition-all">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-6">
        
        {/* Zone 1: 品牌标题（纯手写感与典雅宋体，无任何矩形边框与盒子） */}
        <a 
          href="#" 
          onClick={(e) => {
            e.preventDefault();
            onScrollToExplore();
          }}
          className="text-base md:text-lg font-bold tracking-tight text-[#122818] whitespace-nowrap shrink-0 flex items-center gap-3 group"
        >
          <span className="w-7 h-7 rounded-full bg-[#327346] flex items-center justify-center text-white text-xs group-hover:scale-110 transition-transform">
            🌱
          </span>
          <div className="flex flex-col">
            <span className="font-serif font-black text-base md:text-lg leading-tight text-[#122818] tracking-wider">
              童眼看世界
            </span>
            <span className="text-[11px] text-[#327346] font-sans font-medium tracking-widest mt-0.5">
              生态泥塑成果展览空间
            </span>
          </div>
        </a>

        {/* Zone 2: 导航区（纯留白与字阶过渡，无盒子与边框） */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-[#3B6647]">
          <button 
            type="button"
            onClick={onScrollToExplore}
            className="hover:text-[#122818] transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <Globe2 size={15} className="text-[#327346]" />
            <span>3D 黏土星体</span>
            <span className="text-[11px] font-mono text-[#327346] font-semibold">
              · {pinCount} 点位
            </span>
          </button>

          <button 
            type="button"
            onClick={onScrollToGallery}
            className="hover:text-[#122818] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <BookOpen size={15} className="text-[#327346]" />
            <span>秘密花园画卷</span>
          </button>

          <button 
            type="button"
            onClick={onToggleSound}
            className="hover:text-[#122818] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            {isMuted ? <VolumeX size={15} className="text-gray-400" /> : <Volume2 size={15} className="text-[#327346]" />}
            <span>{isMuted ? '静音' : '八音盒旋律'}</span>
          </button>
        </nav>

        {/* Zone 3: 成果上传按钮 (高质感，无廉价边框) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCreate}
            className="clay-btn px-4 md:px-5 py-2 text-xs md:text-sm font-bold flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Sparkles size={14} className="text-[#F2C338]" />
            <span>创建课题 / 上传成果</span>
          </button>
        </div>

      </div>
    </header>
  );
}
