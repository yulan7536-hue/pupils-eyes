import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, FastForward } from 'lucide-react';
import { storySound } from '../utils/sound';

interface OpeningVideoProps {
  onComplete: () => void;
}

export default function OpeningVideo({ onComplete }: OpeningVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const completedRef = useRef<boolean>(false);

  // 用户上传的真实开幕视频路径
  const videoSrc = '/assets/aistudio/video_3ea63c78.mp4';
  const TOTAL_DURATION = 10; // 必须完整保留 10 秒流程

  const triggerComplete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 700);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {
        // 自动播放策略保护
      });
    }

    // 严谨的 10 秒播放计时控制
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => {
        const next = prev + 0.1;
        if (next >= TOTAL_DURATION) {
          clearInterval(interval);
          triggerComplete();
          return TOTAL_DURATION;
        }
        return next;
      });
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    storySound.setMuted(nextMuted);
    if (!nextMuted) {
      storySound.playChime();
    }
  };

  const handleSkip = () => {
    triggerComplete();
  };

  const progressPercent = Math.min(100, (secondsElapsed / TOTAL_DURATION) * 100);

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#000000] flex items-center justify-center overflow-hidden select-none transition-opacity duration-700 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* 铺满全屏的高清开场视频 */}
      <div className="absolute inset-0 w-full h-full">
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          playsInline
          muted={isMuted}
          className="w-full h-full object-cover"
        />
      </div>

      {/* 柔和暗角晕映，方便顺滑渐入阶段 2 全黑屏幕 */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_transparent_50%,_rgba(0,0,0,0.4)_100%)]" />

      {/* 顶部极简开幕章节文字 */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-2.5 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-white/80 animate-ping" />
        <span className="text-xs font-serif font-medium tracking-widest text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          序章 · 童眼看世界
        </span>
      </div>

      {/* 底部左侧：静音切换 */}
      <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSound}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white text-xs transition-colors cursor-pointer"
        >
          {isMuted ? <VolumeX size={14} className="text-white/60" /> : <Volume2 size={14} className="text-[#81C784]" />}
          <span>{isMuted ? '开音效' : '静音'}</span>
        </button>

        {/* 10秒微型进度指示条 */}
        <div className="flex items-center gap-2 text-[10px] text-white/60 font-mono">
          <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/90 transition-all duration-100 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span>{Math.floor(secondsElapsed)}s / {TOTAL_DURATION}s</span>
        </div>
      </div>

      {/* 角落保留一个不起眼的“跳过动画”小按钮供调试 */}
      <div className="absolute bottom-6 right-6 z-20">
        <button
          type="button"
          onClick={handleSkip}
          className="group flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/30 hover:bg-black/60 text-[11px] text-white/50 hover:text-white/90 transition-all cursor-pointer backdrop-blur-xs"
        >
          <span>跳过动画</span>
          <FastForward size={11} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}
