import { useEffect, useRef, useState } from 'react';
import { storySound } from '../utils/sound';

interface OpeningVideoProps {
  onComplete: () => void;
}

/**
 * 阶段 1：开场影片。文件位于 public/media/opening.mp4（10 秒 / 1280×720 / H.264）。
 * .gitignore 里对 *.mp4 做了全局忽略，这个文件是靠例外规则才被纳入仓库的。
 */
const VIDEO_SRC = '/media/opening.mp4';

/** 读不到时长时的兜底秒数 */
const FALLBACK_DURATION = 10;

/** 迟迟拿不到元数据就判定播放失败，别把观众按在纯黑上 */
const LOAD_GRACE_MS = 4500;

/** 播放失败时给一段静场再放行 */
const FAIL_HOLD_MS = 2200;

/** 淡出时长，与 CSS transition 对齐 */
const FADE_OUT_MS = 800;

export default function OpeningVideo({ onComplete }: OpeningVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const completedRef = useRef(false);
  const progressRef = useRef(0);

  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(FALLBACK_DURATION);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  // 收尾只允许发生一次：结束、跳过、失败兜底三条路径可能同时触发
  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsFadingOut(true);
    window.setTimeout(onComplete, FADE_OUT_MS);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    if (video.paused && !video.ended) {
      const attempt = video.play();
      if (attempt) attempt.catch(() => {});
    }
  }, [isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let raf = 0;
    const sample = () => {
      const total = video.duration;
      if (Number.isFinite(total) && total > 0) {
        const next = Math.min(1, video.currentTime / total);
        if (Math.abs(next - progressRef.current) > 0.003) {
          progressRef.current = next;
          setProgress(next);
        }
      }
      raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const guard = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        setHasFailed(true);
        window.setTimeout(finish, FAIL_HOLD_MS);
      }
    }, LOAD_GRACE_MS);
    return () => window.clearTimeout(guard);
  }, []);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (Number.isFinite(video.duration) && video.duration > 0) setDuration(video.duration);
    const attempt = video.play();
    if (attempt) attempt.catch(() => {});
  };

  const handleError = () => {
    setHasFailed(true);
    window.setTimeout(finish, FAIL_HOLD_MS);
  };

  const elapsed = Math.max(0, Math.min(duration, progress * duration));
  const stamp = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-hidden select-none transition-opacity"
      style={{
        opacity: isFadingOut ? 0 : 1,
        transitionDuration: `${FADE_OUT_MS}ms`,
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      {!hasFailed && (
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          autoPlay
          playsInline
          preload="auto"
          disablePictureInPicture
          muted={isMuted}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={finish}
          onError={handleError}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* 影片不可用时只留一段静场，不伪造影像 */}
      {hasFailed && (
        <div className="absolute inset-0 grid place-items-center">
          <p
            className="text-white/60"
            style={{
              fontFamily: 'var(--serif)',
              fontWeight: 200,
              letterSpacing: '0.6em',
              fontSize: 18,
            }}
          >
            序章
          </p>
        </div>
      )}

      {/* 章节名：与主场景同一套细体柔光语言 */}
      <p
        className="absolute z-10 pointer-events-none"
        style={{
          top: 'clamp(18px, 3vmin, 34px)',
          left: 'clamp(18px, 3vmin, 34px)',
          margin: 0,
          color: '#fff',
          fontWeight: 200,
          fontSize: 'clamp(11px, 1.15vmin, 13px)',
          letterSpacing: '0.42em',
          textShadow: '0 0 12px rgba(255, 227, 155, 0.55), 0 0 28px rgba(255, 227, 155, 0.25)',
        }}
      >
        序章 · 童眼看世界
      </p>

      {/* 播放进度：贴着画面底边的一条细带 */}
      <div
        className="absolute left-0 right-0 bottom-0 z-10 pointer-events-none"
        style={{ height: 2, background: 'rgba(255,255,255,0.16)' }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: 'rgba(255,255,255,0.9)',
            transition: 'width 140ms linear',
          }}
        />
      </div>

      <div
        className="absolute z-10 flex items-center"
        style={{ left: 'clamp(18px, 3vmin, 34px)', bottom: 'clamp(16px, 3vmin, 30px)', gap: 22 }}
      >
        <button type="button" className="vctl" onClick={() => {
          const next = !isMuted;
          setIsMuted(next);
          storySound.setMuted(next);
          if (!next) storySound.playChime();
        }}>
          {isMuted ? '开启声音' : '静音'}
        </button>
        <span
          className="tnum"
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 11,
            fontWeight: 200,
            letterSpacing: '0.18em',
          }}
        >
          {stamp(elapsed)} / {stamp(duration)}
        </span>
      </div>

      <button
        type="button"
        className="vctl"
        onClick={finish}
        style={{ position: 'absolute', right: 'clamp(18px, 3vmin, 34px)', bottom: 'clamp(16px, 3vmin, 30px)' }}
      >
        跳过
      </button>
    </div>
  );
}
