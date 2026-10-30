import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, FastForward, Upload, Play, Pause, Sparkles } from 'lucide-react';
import { storySound } from '../utils/sound';

interface OpeningVideoProps {
  onComplete: () => void;
}

export default function OpeningVideo({ onComplete }: OpeningVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasVideoFile, setHasVideoFile] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [customVideoSrc, setCustomVideoSrc] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [durationSec] = useState<number>(8.5);

  // 当没有检测到本地视频文件时，启动程序化手绘水彩画卷定格动画
  useEffect(() => {
    if (hasVideoFile && !customVideoSrc) {
      // 尝试探测 /opening.mp4 是否可访问
      const testVideo = document.createElement('video');
      testVideo.src = '/opening.mp4';
      testVideo.oncanplay = () => {
        setHasVideoFile(true);
      };
      testVideo.onerror = () => {
        setHasVideoFile(false);
      };
    }
  }, [hasVideoFile, customVideoSrc]);

  // 纯 Canvas 手绘立体书动画（小男孩戴着红围巾在林荫校舍间欢快奔跑）
  useEffect(() => {
    if (hasVideoFile && customVideoSrc) return;
    if (hasVideoFile && videoRef.current && !videoRef.current.error) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let startTime = performance.now();

    const drawStorybookFrame = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const t = elapsed % durationSec;
      const progressRatio = Math.min(elapsed / durationSec, 1);
      setProgress(progressRatio * 100);

      const w = canvas.width;
      const h = canvas.height;

      // 1. 底色：柔和旧羊皮纸水彩漫染
      ctx.fillStyle = '#FAF7EE';
      ctx.fillRect(0, 0, w, h);

      // 2. 纸张颗粒感
      ctx.fillStyle = 'rgba(26, 51, 32, 0.03)';
      for (let i = 0; i < 40; i++) {
        const rx = (Math.sin(i * 99 + t) * 0.5 + 0.5) * w;
        const ry = (Math.cos(i * 33 + t) * 0.5 + 0.5) * h;
        ctx.fillRect(rx, ry, 2, 2);
      }

      // 3. 背景手绘校舍廊柱与拱门（小王子画风）
      ctx.strokeStyle = '#2D4A34';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';

      // 地平线木质走廊地板
      const groundY = h * 0.72;
      ctx.beginPath();
      ctx.moveTo(w * 0.05, groundY);
      ctx.lineTo(w * 0.95, groundY);
      ctx.stroke();

      // 拱廊立柱（随奔跑视差向后流动）
      const offset = (t * 140) % 220;
      for (let x = -100 + offset; x < w + 200; x += 220) {
        // 立柱
        ctx.fillStyle = 'rgba(235, 240, 230, 0.9)';
        ctx.fillRect(x - 14, groundY - 180, 28, 180);
        ctx.strokeRect(x - 14, groundY - 180, 28, 180);

        // 拱门顶部
        ctx.beginPath();
        ctx.arc(x, groundY - 180, 45, Math.PI, 0, false);
        ctx.stroke();

        // 垂挂的小绿藤蔓与绿叶
        ctx.fillStyle = '#52796F';
        for (let j = 0; j < 5; j++) {
          const vy = groundY - 160 + j * 16 + Math.sin(t * 3 + j) * 4;
          const vx = x + Math.sin(j * 2) * 12;
          ctx.beginPath();
          ctx.ellipse(vx, vy, 6, 3, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. 温暖的晨曦金光束从拱廊洒入
      const gradient = ctx.createLinearGradient(w * 0.3, 0, w * 0.7, groundY);
      gradient.addColorStop(0, 'rgba(255, 222, 89, 0.35)');
      gradient.addColorStop(0.8, 'rgba(255, 222, 89, 0.08)');
      gradient.addColorStop(1, 'rgba(255, 222, 89, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, 0);
      ctx.lineTo(w * 0.9, groundY);
      ctx.lineTo(w * 0.5, groundY);
      ctx.lineTo(w * 0.05, 0);
      ctx.closePath();
      ctx.fill();

      // 5. 核心主角：奔跑的小男孩（手绘定格风格）
      const boyX = w * 0.45;
      const bounce = Math.abs(Math.sin(t * 12)) * 14;
      const boyY = groundY - 60 - bounce;

      // 脚步扬起的草叶与轻烟
      ctx.fillStyle = 'rgba(133, 169, 143, 0.4)';
      for (let p = 0; p < 4; p++) {
        const dustX = boyX - 25 - p * 8 + Math.sin(t * 20 + p) * 5;
        const dustY = groundY - 5 - p * 3;
        ctx.beginPath();
        ctx.arc(dustX, dustY, 3 + p, 0, Math.PI * 2);
        ctx.fill();
      }

      // 影子（定格黏土扁椭圆）
      ctx.fillStyle = 'rgba(26, 51, 32, 0.25)';
      ctx.beginPath();
      ctx.ellipse(boyX, groundY - 2, 22 - bounce * 0.3, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // 双腿（定格交替跑步）
      const legPhase = Math.sin(t * 12);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1A3320';

      // 左腿
      ctx.beginPath();
      ctx.moveTo(boyX - 4, boyY + 36);
      ctx.lineTo(boyX - 4 + legPhase * 16, boyY + 60);
      ctx.stroke();

      // 右腿
      ctx.beginPath();
      ctx.moveTo(boyX + 4, boyY + 36);
      ctx.lineTo(boyX + 4 - legPhase * 16, boyY + 60);
      ctx.stroke();

      // 上衣（温暖浅绿与米白相间的手工小衫）
      ctx.fillStyle = '#85A98F';
      ctx.beginPath();
      ctx.roundRect(boyX - 14, boyY + 12, 28, 28, 6);
      ctx.fill();
      ctx.stroke();

      // 小脑袋
      ctx.fillStyle = '#F5DEB3';
      ctx.beginPath();
      ctx.arc(boyX, boyY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 蓬松深褐色头发
      ctx.fillStyle = '#5A3825';
      ctx.beginPath();
      ctx.arc(boyX - 2, boyY - 4, 15, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();

      // 《小王子》标志性飞扬的红围巾！
      ctx.fillStyle = '#D64545';
      ctx.strokeStyle = '#8B0000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // 脖子处结
      ctx.ellipse(boyX - 1, boyY + 12, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 随风向后剧烈飘拂的长围巾尾
      ctx.beginPath();
      ctx.moveTo(boyX - 8, boyY + 12);
      const wave1 = Math.sin(t * 16) * 12;
      const wave2 = Math.cos(t * 16) * 14;
      ctx.quadraticCurveTo(boyX - 35, boyY + 12 + wave1, boyX - 65, boyY + 6 + wave2);
      ctx.lineTo(boyX - 60, boyY + 16 + wave2);
      ctx.quadraticCurveTo(boyX - 30, boyY + 19 + wave1, boyX - 4, boyY + 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 6. 前景绿植拱廊剪影
      ctx.fillStyle = '#1A3320';
      ctx.beginPath();
      ctx.arc(w * 0.9, groundY - 80, 70, 0, Math.PI * 2);
      ctx.fill();

      // 如果动画达到尾声，自动转场到藤蔓大门
      if (elapsed >= durationSec) {
        storySound.playPaperTurn();
        onComplete();
        return;
      }

      animId = requestAnimationFrame(drawStorybookFrame);
    };

    animId = requestAnimationFrame(drawStorybookFrame);
    return () => cancelAnimationFrame(animId);
  }, [hasVideoFile, customVideoSrc, durationSec, onComplete]);

  // 处理用户上传自己的本地视频
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomVideoSrc(url);
      setHasVideoFile(true);
      storySound.playPaperTurn();
    }
  };

  const handleSkip = () => {
    storySound.playPaperTurn();
    onComplete();
  };

  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    storySound.setMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    if (!nextMuted) {
      storySound.playChime();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-[#F3F7F0] select-none">
      {/* 立体书外壳容器 */}
      <div className="relative w-full max-w-4xl aspect-[16/9] parchment-sheet hand-drawn-border hand-drawn-box flex flex-col justify-between p-4 md:p-6 overflow-hidden">
        
        {/* 顶部标签 */}
        <div className="flex items-center justify-between border-b border-[#1A3320]/15 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <div>
              <h2 className="text-sm md:text-base font-bold text-[#1A3320] tracking-wide">
                翻开立体书 · 小王子童心启程
              </h2>
              <p className="text-[11px] text-[#52796F]">
                红围巾少年奔向校舍绿廊，藤蔓门后藏着星空与大地的回响
              </p>
            </div>
          </div>

          {/* 上传自定义视频入口 */}
          <label className="flex items-center gap-1.5 px-3 py-1 bg-[#F3F7F0] hover:bg-[#85A98F] hover:text-white border border-[#1A3320] rounded-full text-xs cursor-pointer transition-colors hand-drawn-box-sm">
            <Upload size={13} />
            <span className="hidden sm:inline">载入本地 MP4 视频</span>
            <span className="sm:hidden">换视频</span>
            <input 
              type="file" 
              accept="video/mp4,video/webm" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>
        </div>

        {/* 核心视窗：真视频播放器 或 纯手绘定格动画 Canvas */}
        <div className="relative flex-1 my-3 rounded-lg overflow-hidden border border-[#1A3320]/30 bg-[#2D4A34]/5 flex items-center justify-center">
          {customVideoSrc ? (
            <video
              ref={videoRef}
              src={customVideoSrc}
              autoPlay
              playsInline
              muted={isMuted}
              onEnded={() => {
                storySound.playPaperTurn();
                onComplete();
              }}
              className="w-full h-full object-cover"
            />
          ) : hasVideoFile ? (
            <video
              ref={videoRef}
              src="/opening.mp4"
              autoPlay
              playsInline
              muted={isMuted}
              onError={() => setHasVideoFile(false)}
              onEnded={() => {
                storySound.playPaperTurn();
                onComplete();
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              className="w-full h-full object-cover"
            />
          )}

          {/* 覆盖一层旧纸张纹理暗角 */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#1A3320]/15 via-transparent to-[#1A3320]/10 mix-blend-multiply" />

          {/* 动画标识 */}
          <div className="absolute bottom-3 left-3 bg-[#FAF7EE]/90 border border-[#1A3320] px-2.5 py-0.5 rounded text-[11px] text-[#1A3320] flex items-center gap-1.5 shadow-sm">
            <Sparkles size={12} className="text-[#85A98F]" />
            <span>{!hasVideoFile && !customVideoSrc ? '定格手绘立体画卷渲染中' : '沉浸式影像播映中'}</span>
          </div>
        </div>

        {/* 底部控制台 */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSound}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#FAF7EE] hover:bg-[#F3F7F0] border border-[#1A3320] rounded-full text-xs text-[#1A3320] transition-colors"
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} className="text-[#85A98F]" />}
              <span>{isMuted ? '开启声音' : '静音'}</span>
            </button>

            {/* 播放进度指示 */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#52796F]">
              <div className="w-24 h-1.5 bg-[#1A3320]/15 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#85A98F] transition-all duration-200"
                  style={{ width: `${progress}%` }} 
                />
              </div>
              <span className="font-mono text-[11px]">8.5s 序章</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#85A98F] hover:bg-[#52796F] text-white text-xs md:text-sm font-bold rounded-full hand-drawn-border hand-drawn-box hand-drawn-box-pressed transition-all"
          >
            <span>翻过此页，推开藤蔓门</span>
            <FastForward size={14} />
          </button>
        </div>

      </div>
    </div>
  );
}
