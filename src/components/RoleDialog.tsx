import { useEffect, useState } from 'react';
import type { LocationChoice, Role, SubmissionPayload } from '../types';
import { storySound } from '../utils/sound';
import { analyzeLessonSync } from '../utils/aiLesson';

interface RoleDialogProps {
  location: LocationChoice;
  onClose: () => void;
  onSubmit: (payload: SubmissionPayload) => void;
}

/**
 * 落钉之后自动弹出：先选身份，再填这份成果。
 * 身份文案为需求指定原文，不要改写。
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    const isTeacher = role === 'TEACHER';

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
      content: content.trim() || '这份成果刚放上课桌，说明还在整理中。',
      imageUrl: image ?? undefined,
      digitalResourceUrl: resourceUrl.trim() || undefined,
      date: '刚刚',
      // 教师教案：先同步生成规则引擎雷达图兜底，真 AI 结果由 App 异步覆盖
      radar: isTeacher ? analyzeLessonSync(content.trim()) : undefined,
    });
    storySound.playPinDrop();
  };

  return (
    <div
      className="veil"
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog" style={{ width: step === 'form' ? 'min(520px, 94vw)' : undefined }}>
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
              {role === 'TEACHER' ? '记一篇教案实录' : '放一份成果上课桌'}
            </h2>
            <p className="dialog__sub">
              {role === 'TEACHER'
                ? '教学设计与课程指导记录会归入《教案实录手账》。'
                : '数字资源包与成果图片会归入《学生成果展示》。'}
            </p>

            <label className="field">
              <span className="field__label">
                {role === 'TEACHER' ? '课题名称' : '成果名称'}
              </span>
              <input
                className="input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  role === 'TEACHER' ? '例如：天工开物之安吉竹器结构' : '例如：水生净化资源包'
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
                {role === 'TEACHER' ? '执教老师' : '作者与年龄'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder={role === 'TEACHER' ? '林木老师' : '小鹿同学'}
                />
                {role === 'STUDENT' && (
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
                {role === 'TEACHER' ? '教案实录与指导记录' : '成果说明'}
              </span>
              <textarea
                className="input"
                required
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  role === 'TEACHER'
                    ? '记录教学引导策略、实施步骤与跨学科反思…'
                    : '说说你的成果是怎么做出来的…'
                }
              />
            </label>

            <label className="field">
              <span className="field__label">
                {role === 'TEACHER' ? '课程视频链接（选填）' : '数字资源包链接（选填）'}
              </span>
              <input
                className="input"
                type="url"
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                placeholder="https://"
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
              <button type="submit" className="btn btn--full">
                归档到课桌
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
