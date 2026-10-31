import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LocationChoice, RadarAnalysis, Role, SubmissionPayload } from '../types';
import { storySound } from '../utils/sound';
import { analyzeLesson, analyzeLessonSync } from '../utils/aiLesson';
import { PROVIDERS_META, providerStates, readyProviders } from '../utils/aiConfig';
import { ACCEPT_ATTR, parseLessonFile } from '../utils/lessonFile';
import RadarChart from './RadarChart';
import AiSettings from './AiSettings';

interface RoleDialogProps {
  location: LocationChoice;
  onClose: () => void;
  onSubmit: (payload: SubmissionPayload) => void;
}

type Stage = 'idle' | 'reading' | 'analyzing' | 'done' | 'error';

/**
 * 落钉之后自动弹出：先选身份，再填这份成果。
 * 教师身份额外提供「上传教案文件 → 自动抽取正文 → 六维雷达图即时预览」。
 */
export default function RoleDialog({ location, onClose, onSubmit }: RoleDialogProps) {
  const [step, setStep] = useState<'role' | 'form'>('role');
  const [role, setRole] = useState<Role | null>(null);

  const [title, setTitle] = useState('');
  const [school, setSchool] = useState('');
  const [author, setAuthor] = useState('');
  const [age, setAge] = useState('9');
  const [content, setContent] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [image, setImage] = useState<string | null>(null);

  // —— 教案上传与自动识别 ——
  const [stage, setStage] = useState<Stage>('idle');
  const [fileName, setFileName] = useState('');
  const [fileMeta, setFileMeta] = useState('');
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [radar, setRadar] = useState<RadarAnalysis | null>(null);
  const [showRadar, setShowRadar] = useState(false);
  const [trying, setTrying] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [engineTick, setEngineTick] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const runId = useRef(0);

  /** 当前实际会用的引擎一览，Key 变更后靠 engineTick 触发重算 */
  const engine = useMemo(() => {
    void engineTick;
    const states = providerStates();
    const ready = readyProviders();
    // 只数填了 Key 的平台：免 Key 通道慢且限流，不算「已提速」
    const keyed = states.filter((s) => s.ready && !s.keyless).length;
    return {
      keyed,
      label: ready.length
        ? ready.map((id) => PROVIDERS_META.find((p) => p.id === id)!.short).join(' → ')
        : '仅本地规则引擎',
    };
  }, [engineTick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pickRole = (next: Role) => {
    storySound.playPaperTurn();
    setRole(next);
    setStep('form');
  };

  /** 拿到正文后跑六维识别：先规则引擎即时出图，再用大模型覆盖 */
  const recognize = useCallback(async (text: string) => {
    const my = ++runId.current;
    const trimmed = text.trim();
    if (trimmed.length < 24) {
      setRadar(null);
      setStage('idle');
      return;
    }

    setStage('analyzing');
    setRadar(analyzeLessonSync(trimmed)); // 立即出图，教师不用等
    try {
      const analysis = await analyzeLesson(trimmed, {
        onTrying: (label) => {
          if (my === runId.current) setTrying(label);
        },
      });
      if (my !== runId.current) return;
      setRadar(analysis);
      setStage('done');
      setShowRadar(true);
    } catch {
      if (my !== runId.current) return;
      setStage('done');
      setShowRadar(true);
    } finally {
      if (my === runId.current) setTrying('');
    }
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setFileErr(null);
      setFileName(file.name);
      setFileMeta('');
      setStage('reading');
      setRadar(null);
      try {
        const parsed = await parseLessonFile(file);
        setFileMeta(parsed.meta);
        setContent(parsed.text);
        if (!title.trim()) setTitle(parsed.title);
        await recognize(parsed.text);
      } catch (err) {
        setStage('error');
        setFileName('');
        setFileErr(err instanceof Error ? err.message : '文件解析失败，请换一份再试');
      }
    },
    [recognize, title]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    const isTeacher = role === 'TEACHER';
    const body = content.trim();

    onSubmit({
      id: Date.now().toString(),
      region: location.locationString.replace(/·/g, ' · '),
      province: location.province,
      city: location.city,
      district: location.district,
      lat: location.lat,
      lon: location.lon,
      title: title.trim() || `童眼看${location.district} · 行智开物`,
      role,
      school: school.trim() || `${location.district}行智开物实验学校`,
      author: author.trim() || (isTeacher ? '开物导师' : `探索学员（${age}岁）`),
      content: body || '这份成果刚放上课桌，说明还在整理中。',
      imageUrl: image ?? undefined,
      digitalResourceUrl: resourceUrl.trim() || undefined,
      date: '刚刚',
      // 教师教案：带上已识别好的雷达图，App 只在这份还没跑过 AI 时才补算
      radar: isTeacher ? radar ?? analyzeLessonSync(body) : undefined,
    });
    storySound.playPinDrop();
  };

  const teacher = role === 'TEACHER';
  const busy = stage === 'reading' || stage === 'analyzing';

  return (
    <>
      <div
        className="veil"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
      <div className="dialog" style={{ width: step === 'form' ? 'min(620px, 95vw)' : undefined }}>
        {step === 'role' ? (
          <>
            <h2 className="dialog__title" id="role-title">
              请选择你的身份
            </h2>
            <p className="dialog__sub">
              坐标已落定 · {location.locationString.replace(/·/g, ' · ')}
            </p>

            <div className="roles">
              <button type="button" className="role" onClick={() => pickRole('STUDENT')}>
                <span className="role__name">
                  <span className="role__dot" style={{ background: 'var(--sage-deep)' }} />
                  我是学生
                </span>
                <span className="role__desc">
                  分享你的课程结项成果，包括但不限于你的数字资源包、你的成果图片等。
                </span>
              </button>

              <button type="button" className="role" onClick={() => pickRole('TEACHER')}>
                <span className="role__name">
                  <span className="role__dot" style={{ background: 'var(--rose-deep)' }} />
                  我是教师
                </span>
                <span className="role__desc">
                  分享你的教案实录手账、教学设计与课程指导记录。
                </span>
              </button>
            </div>

            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <button type="button" className="btn btn--quiet" onClick={onClose}>
                稍后再说
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 className="dialog__title" id="role-title">
              {teacher ? '记一篇教案实录' : '放一份成果上课桌'}
            </h2>
            <p className="dialog__sub">
              {teacher
                ? '上传教案文件后自动识别，生成六维智能雷达图。'
                : '数字资源包与成果图片会归入《学生成果展示》。'}
            </p>

            {/* 教师：教案上传 + 自动六维识别 */}
            {teacher && (
              <div className="intake">
                <div className="intake__engine">
                  <span className={`intake__dot${engine.keyed > 0 ? ' is-on' : ''}`} aria-hidden="true" />
                  <span className="intake__engine-text">
                    识别引擎：<b>{engine.label}</b>
                    {engine.keyed > 0
                      ? `（${engine.keyed} 个已就绪，通常 1-3 秒出结果）`
                      : '，尚未接免费模型，走免 Key 通道约需 20 秒'}
                  </span>
                  <button
                    type="button"
                    className="intake__engine-btn"
                    onClick={() => setSettingsOpen(true)}
                  >
                    设置
                  </button>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT_ATTR}
                  className="intake__file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = '';
                  }}
                />

                <button
                  type="button"
                  className={`intake__drop${dragging ? ' is-drag' : ''}${busy ? ' is-busy' : ''}`}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <span className="intake__icon" aria-hidden="true">
                    {busy ? (
                      <span className="intake__spin" />
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11A2.5 2.5 0 0 0 20 18.5V15"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>

                  <span className="intake__text">
                    {stage === 'reading' ? (
                      <>
                        <b>正在读取文件…</b>
                        <span>{fileName}</span>
                      </>
                    ) : stage === 'analyzing' ? (
                      <>
                        <b>正在通读教案，识别六个维度…</b>
                        <span>{trying ? `正在调用 ${trying}` : '雷达图已先出图，AI 点评回来后自动覆盖'}</span>
                      </>
                    ) : fileName ? (
                      <>
                        <b>{fileName}</b>
                        <span>
                          {fileMeta || '已识别'} · 点击可重新上传
                        </span>
                      </>
                    ) : (
                      <>
                        <b>上传教案文件，自动生成六维雷达图</b>
                        <span>拖到这里，或点击选择 · 支持 docx / pdf / txt / md（≤12MB）</span>
                      </>
                    )}
                  </span>
                </button>

                {fileErr && <p className="intake__err">{fileErr}</p>}

                {content.trim().length >= 24 && !busy && stage !== 'error' && (
                  <div className="intake__actions">
                    <button
                      type="button"
                      className="intake__retry"
                      onClick={() => void recognize(content)}
                    >
                      重新识别六个维度
                    </button>
                    {radar && (
                      <button
                        type="button"
                        className="intake__retry"
                        onClick={() => setShowRadar((v) => !v)}
                      >
                        {showRadar ? '收起雷达图' : '查看雷达图'}
                      </button>
                    )}
                  </div>
                )}

                {radar && showRadar && (
                  <div className="radar-wrap radar-wrap--compact">
                    <div className="radar-wrap__head">
                      <span className="radar-wrap__title">六维智能雷达图</span>
                      <span className="radar-wrap__tag tnum">
                        {stage === 'analyzing'
                          ? '识别中…'
                          : radar.source === 'ai'
                            ? `${radar.model ?? 'AI'}${radar.latencyMs ? ` · ${(radar.latencyMs / 1000).toFixed(1)}s` : ''}`
                            : '规则引擎'}
                      </span>
                    </div>
                    <RadarChart analysis={radar} />

                    {stage === 'done' && radar.source === 'heuristic' && (
                      <p className="intake__hint">
                        当前为本地规则引擎评分（不联网、零延迟）。想拿到真正读懂教案的 AI 点评，
                        <button
                          type="button"
                          className="intake__hint-btn"
                          onClick={() => setSettingsOpen(true)}
                        >
                          填一个免费模型 Key
                        </button>
                        ，30 秒即可，永久免费。
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className={teacher ? 'form-grid' : undefined}>
              <label className="field">
                <span className="field__label">
                  {teacher ? '课题名称' : '成果名称'}
                </span>
                <input
                  className="input"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    teacher ? '例如：天工开物之安吉竹器结构' : '例如：水生净化资源包'
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">所属学校</span>
                <input
                  className="input"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder={`${location.district}行智开物实验学校`}
                />
              </label>

              <label className="field">
                <span className="field__label">
                  {teacher ? '执教老师' : '作者与年龄'}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder={teacher ? '林木老师' : '小鹿同学'}
                  />
                  {!teacher && (
                    <input
                      className="input tnum"
                      style={{ width: 78, textAlign: 'center' }}
                      type="number"
                      min={4}
                      max={18}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      aria-label="年龄"
                    />
                  )}
                </div>
              </label>

              <label className="field">
                <span className="field__label">
                  {teacher ? '课程视频链接（选填）' : '数字资源包链接（选填）'}
                </span>
                <input
                  className="input"
                  type="url"
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="https://"
                />
              </label>
            </div>

            <label className="field">
              <span className="field__label">
                {teacher ? '教案正文（上传后自动填入，可直接编辑）' : '成果说明'}
              </span>
              <textarea
                className="input"
                required
                rows={teacher ? 6 : 4}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  if (stage === 'done') {
                    setStage('idle');
                    setRadar(null);
                    setShowRadar(false);
                  }
                }}
                placeholder={
                  teacher
                    ? '记录教学引导策略、实施步骤与跨学科反思…也可直接上传文档'
                    : '说说你的成果是怎么做出来的…'
                }
              />
            </label>

            <label className="field">
              <span className="field__label">成果图片（选填）</span>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setImage(URL.createObjectURL(file));
                }}
                style={{ paddingTop: 10 }}
              />
            </label>

            {image && (
              <img
                src={image}
                alt="成果图片预览"
                style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 12 }}
              />
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" className="btn btn--quiet" onClick={() => setStep('role')}>
                重选身份
              </button>
              <button type="submit" className="btn btn--full" disabled={busy}>
                {busy ? '识别中…' : '归档到课桌'}
              </button>
            </div>
          </form>
        )}
      </div>
      </div>

      {settingsOpen && (
        <AiSettings
          onClose={() => setSettingsOpen(false)}
          onChanged={() => setEngineTick((n) => n + 1)}
        />
      )}
    </>
  );
}
