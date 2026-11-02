import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Role, WorkItem } from '../types';
import { CLOUD_ORIGIN, cloudReachable, themeKeyOf } from '../utils/cloudConfig';
import type { ThemePhoto } from '../utils/cloudConfig';
import { storySound } from '../utils/sound';

/** 云 SDK 只在真要读写照片时才拉，别让它蹲在首屏包里 */
const cloudStore = () => import('../utils/cloudStore');

interface PhotoWallProps {
  /** 当前这颗图钉（= 一门课）。照片按它自动归类，不需要谁去挑主题 */
  work: WorkItem;
  /** 教案书页里那一版：书页本来就窄，卡片收小一档才不至于把正文挤出屏 */
  compact?: boolean;
}

const ROLE_LABEL: Record<Role, string> = { TEACHER: '老师', STUDENT: '学生' };

/**
 * 课题成果照片墙。
 *
 * 一个人在课上拍、另一个人在课后补传，都会落到同一门课下 —— 因为主题键是从
 * 当前这颗图钉推出来的，不靠人挑。墙本身是一条横滑轨道：新传的在最前，
 * 点任意一张放大看。
 */
export default function PhotoWall({ work, compact = false }: PhotoWallProps) {
  const themeKey = themeKeyOf(work);
  // 站在不被云端放行的域名上（比如 GitHub Pages）就别发起请求了，直接说明去哪儿看
  const reachable = cloudReachable();

  const [photos, setPhotos] = useState<ThemePhoto[]>([]);
  const [loading, setLoading] = useState(reachable);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ThemePhoto | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const railRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!reachable) return;
    setLoading(true);
    setError(null);
    try {
      const { listThemePhotos } = await cloudStore();
      setPhotos(await listThemePhotos(themeKey));
    } catch (e) {
      setError(e instanceof Error ? e.message : '照片墙加载失败');
    } finally {
      setLoading(false);
    }
  }, [themeKey, reachable]);

  useEffect(() => {
    void load();
  }, [load]);

  // 关掉放大 / 上传面板时要能把焦点和滚动手势还回去
  useEffect(() => {
    if (!view && !uploadOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setView(null);
      setUploadOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [view, uploadOpen]);

  const onAdded = (photo: ThemePhoto) => {
    setPhotos((prev) => [photo, ...prev]);
    setUploadOpen(false);
    // 传完把轨道拨回最前，让人立刻看见自己那张
    requestAnimationFrame(() => {
      railRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    });
  };

  return (
    <section
      className={`photowall${compact ? ' photowall--compact' : ''}`}
      aria-label={`${work.title} 的课题成果照片`}
    >
      <header className="photowall__head">
        <span className="photowall__title">
          课题成果照片
          <span className="photowall__theme">{work.title}</span>
        </span>
        {reachable && (
          <span className="photowall__meta tnum">
            {loading ? '同步中…' : `${photos.length} 张`}
          </span>
        )}
      </header>

      {!reachable ? (
        <p className="photowall__offline">
          照片存在云端，要连上才拉得下来。
          <a href={`${CLOUD_ORIGIN}/#note`} target="_blank" rel="noreferrer noopener">
            到 {CLOUD_ORIGIN.replace(/^https?:\/\//, '')} 打开
          </a>
        </p>
      ) : error ? (
        <div className="photowall__note">
          <p>{error}</p>
          <button type="button" className="btn btn--quiet" onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : (
        <div className="photowall__rail no-scrollbar" ref={railRef}>
          <button
            type="button"
            className="photowall__add"
            onClick={() => {
              storySound.playPaperTurn();
              setUploadOpen(true);
            }}
          >
            <span className="photowall__add-icon" aria-hidden="true">
              ＋
            </span>
            <span>上传成果</span>
          </button>

          {loading && photos.length === 0 && (
            <>
              {[0, 1, 2].map((i) => (
                <div className="photowall__card is-skeleton" key={i} aria-hidden="true" />
              ))}
            </>
          )}

          {photos.map((p) => (
            <button
              type="button"
              className="photowall__card"
              key={p.id}
              onClick={() => {
                storySound.playPinDrop();
                setView(p);
              }}
              aria-label={`${p.uploader} 上传的成果照片`}
            >
              <img src={p.imageData} alt={p.caption ?? `${p.uploader} 的成果照片`} loading="lazy" />
              <span className="photowall__cap">
                <span className="photowall__who">{p.uploader}</span>
                <span className={`photowall__role photowall__role--${p.role.toLowerCase()}`}>
                  {ROLE_LABEL[p.role]}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {reachable && !loading && !error && photos.length === 0 && (
        <p className="photowall__empty">
          这门课还没有现场照片。老师和学生都可以随手传一张，传上来会自动归到这门课。
        </p>
      )}

      {uploadOpen && (
        <UploadSheet
          work={work}
          onClose={() => setUploadOpen(false)}
          onAdded={onAdded}
        />
      )}

      {view &&
        createPortal(
          <div
            className="photowall__viewer"
            role="dialog"
            aria-modal="true"
            aria-label="成果照片"
            onClick={() => setView(null)}
          >
            <figure className="photowall__viewer-inner" onClick={(e) => e.stopPropagation()}>
              <img src={view.imageData} alt={view.caption ?? `${view.uploader} 的成果照片`} />
              <figcaption>
                <span className="photowall__viewer-who">
                  {view.uploader}
                  <span className={`photowall__role photowall__role--${view.role.toLowerCase()}`}>
                    {ROLE_LABEL[view.role]}
                  </span>
                </span>
                {view.caption && <span className="photowall__viewer-cap">{view.caption}</span>}
                <span className="photowall__viewer-time">{formatWhen(view.createdAt)}</span>
              </figcaption>
              <button type="button" className="photowall__viewer-x" onClick={() => setView(null)}>
                收起
              </button>
            </figure>
          </div>,
          document.body
        )}
    </section>
  );
}

/* ---------------- 上传面板 ---------------- */

function UploadSheet({
  work,
  onClose,
  onAdded,
}: {
  work: WorkItem;
  onClose: () => void;
  onAdded: (p: ThemePhoto) => void;
}) {
  const [name, setName] = useState(work.author || '');
  const [role, setRole] = useState<Role>(work.role ?? 'STUDENT');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setErr('只能传照片');
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setErr('这张太大了，换一张（12MB 以内）');
      return;
    }
    setErr(null);
    setFile(f);
  };

  const submit = async () => {
    if (!file) {
      setErr('先选一张照片');
      return;
    }
    if (!name.trim()) {
      setErr('写上名字，方便别人知道是谁拍的');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { addThemePhoto } = await cloudStore();
      const photo = await addThemePhoto({ theme: work, uploader: name, role, caption, file });
      storySound.playChime();
      onAdded(photo);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="photowall__sheet-veil"
      role="dialog"
      aria-modal="true"
      aria-label="上传课题成果照片"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="photowall__sheet">
        <div className="photowall__sheet-head">
          <span>上传到《{work.title}》</span>
          <button type="button" className="photowall__sheet-x" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <button
          type="button"
          className={`photowall__pick${preview ? ' is-filled' : ''}`}
          onClick={() => inputRef.current?.click()}
        >
          {preview ? (
            <img src={preview} alt="待上传照片预览" />
          ) : (
            <>
              <span className="photowall__pick-icon" aria-hidden="true">
                ＋
              </span>
              <span>选一张成果照片</span>
              <span className="photowall__pick-hint">会自动压缩到长边 900px</span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />

        <div className="photowall__row">
          <label className="photowall__field">
            <span>署名</span>
            <input
              className="input"
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              placeholder="谁拍的"
            />
          </label>

          <div className="photowall__field">
            <span>身份</span>
            <div className="photowall__seg">
              {(['STUDENT', 'TEACHER'] as Role[]).map((r) => (
                <button
                  type="button"
                  key={r}
                  className={`photowall__seg-btn${role === r ? ' is-on' : ''}`}
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="photowall__field">
          <span>一句话（可选）</span>
          <input
            className="input"
            value={caption}
            maxLength={60}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="这是在做什么"
          />
        </label>

        {err && <p className="photowall__err">{err}</p>}

        <div className="photowall__sheet-foot">
          <button type="button" className="btn btn--quiet" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="button" className="btn btn--rose" onClick={() => void submit()} disabled={busy}>
            {busy ? '上传中…' : '传上去'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function formatWhen(iso: string) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const diff = Date.now() - t.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`;
}
