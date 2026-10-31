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
      {/* 鼠标悬停微标签 */}
      <span className="hidden sm:inline-block px-3 py-1 bg-[#FAF5E8] border-2 border-[#1E3824] rounded-full text-xs font-black text-[#1E3824] shadow-xs group-hover:bg-[#6E9277] group-hover:text-white transition-all">
        {isMuted ? '开启声音' : '八音盒旋律中'}
      </span>

      {/* 经典同心圆黑胶/定格转盘（学习参考视频右下角动效） */}
      <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center">
        {/* 外圈同心环 1 */}
        <div 
          className={`absolute inset-0 rounded-full border-4 border-[#1E3824]/30 ${
            !isMuted ? 'animate-spin' : ''
          }`}
          style={{ animationDuration: '8s' }}
        />

        {/* 内圈同心环 2 */}
        <div 
          className={`absolute inset-2 rounded-full border-3 border-[#1E3824]/50 border-dashed ${
            !isMuted ? 'animate-spin' : ''
          }`}
          style={{ animationDuration: '4s', animationDirection: 'reverse' }}
        />

        {/* 核心定格黏土转纽 */}
        <div className="relative w-8 h-8 rounded-full bg-[#6E9277] border-2 border-[#1E3824] flex items-center justify-center text-white shadow-xs group-hover:scale-110 transition-transform">
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="animate-pulse" />}
        </div>
      </div>
    </div>
  );
}
