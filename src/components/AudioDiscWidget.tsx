import { Volume2, VolumeX } from 'lucide-react';
import { storySound } from '../utils/sound';

interface AudioDiscWidgetProps {
  isMuted: boolean;
  onToggleSound: () => void;
}

export default function AudioDiscWidget({ isMuted, onToggleSound }: AudioDiscWidgetProps) {
  return (
    <div 
      onClick={() => {
        storySound.playPaperTurn();
        onToggleSound();
      }}
      className="fixed bottom-6 right-6 z-30 cursor-pointer group flex items-center gap-3 select-none"
      title={isMuted ? '点击开启音乐八音盒' : '点击静音'}
    >
      {/* 鼠标悬停纯文字标签（无边框、无阴影） */}
      <span className="hidden sm:inline-block px-3 py-1 bg-white/80 backdrop-blur-xs rounded-full text-xs font-bold text-[#122818] group-hover:bg-[#2F6B3F] group-hover:text-white transition-all">
        {isMuted ? '开启声音' : '八音盒旋律中'}
      </span>

      {/* 经典同心圆有机定格转盘（无边框、无生硬黑线与阴影） */}
      <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center bg-[#E5EFE2]/80 backdrop-blur-xs">
        {/* 外圈同心环 1 */}
        <div 
          className={`absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-[#2F6B3F]/15 to-transparent ${
            !isMuted ? 'animate-spin' : ''
          }`}
          style={{ animationDuration: '8s' }}
        />

        {/* 内圈同心环 2 */}
        <div 
          className={`absolute inset-1.5 rounded-full bg-[#FAFBF8] ${
            !isMuted ? 'animate-spin' : ''
          }`}
          style={{ animationDuration: '4s', animationDirection: 'reverse' }}
        />

        {/* 核心定格黏土转纽 */}
        <div className="relative w-7 h-7 rounded-full bg-[#2F6B3F] flex items-center justify-center text-white group-hover:scale-110 transition-transform">
          {isMuted ? <VolumeX size={14} className="text-white/80" /> : <Volume2 size={14} className="animate-pulse text-[#FFE066]" />}
        </div>
      </div>
    </div>
  );
}
