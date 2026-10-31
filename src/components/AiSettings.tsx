import { useEffect, useMemo, useState } from 'react';
import {
  PROVIDERS_META,
  getKey,
  providerStates,
  readyProviders,
  setKey,
  clearFailed,
  type ProviderId,
} from '../utils/aiConfig';
import { testProvider } from '../utils/aiLesson';

interface AiSettingsProps {
  onClose: () => void;
  /** Key 保存后回调，让上层刷新「当前用哪个模型」的提示 */
  onChanged?: () => void;
}

type TestState = { busy: boolean; ok?: boolean; text?: string };

/**
 * 模型设置面板：让用户在自己浏览器里粘贴免费平台 Key，即时生效、无需重新构建。
 * Key 只存在 localStorage，不上传任何服务器。
 */
export default function AiSettings({ onClose, onChanged }: AiSettingsProps) {
  const [states, setStates] = useState(() => providerStates());
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [test, setTest] = useState<Record<string, TestState>>({});
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const refresh = () => {
    setStates(providerStates());
    onChanged?.();
  };

  const chainLabel = useMemo(() => {
    const ids = readyProviders();
    return ids
      .map((id) => PROVIDERS_META.find((p) => p.id === id)!.short)
      .join(' → ');
  }, [states]);

  const save = (id: ProviderId) => {
    const v = draft[id] ?? '';
    setKey(id, v);
    clearFailed(); // 换了 Key，之前记下的失败要清掉，否则会被跳过
    setDraft((d) => ({ ...d, [id]: '' }));
    refresh();
    setFlash(v.trim() ? '已保存，下次识别就用上了' : '已清除该平台的 Key');
    window.setTimeout(() => setFlash(null), 2600);
  };

  const runTest = async (id: ProviderId) => {
    setTest((t) => ({ ...t, [id]: { busy: true } }));
    const r = await testProvider(id);
    setTest((t) => ({
      ...t,
      [id]: {
        busy: false,
        ok: r.ok,
        text: r.ok ? `连通 ${r.ms}ms · ${r.detail}` : `失败 ${r.ms}ms · ${r.detail}`,
      },
    }));
  };

  return (
    <div
      className="veil"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog ai-set" style={{ width: 'min(640px, 95vw)' }}>
        <h2 className="dialog__title" id="ai-settings-title">
          大模型接入设置
        </h2>
        <p className="dialog__sub">
          全部为免费公开通道，按下面的顺序自动尝试：<b>{chainLabel || '暂无'}</b>
          <br />
          首选 OpenRouter：<b>邮箱或 GitHub 登录即可，不用实名、不用绑卡、无需企业认证</b>。
          Key 只保存在本机浏览器，不会上传；不填 Key 也能用免 Key 通道与本地规则引擎。
        </p>

        <div className="ai-set__list">
          {states.map((p) => {
            const t = test[p.id];
            const inputId = `key-${p.id}`;
            return (
              <div key={p.id} className="ai-set__item">
                <div className="ai-set__head">
                  <span className="ai-set__name">
                    {p.label}
                    <span className={`ai-set__speed ai-set__speed--${p.speed}`}>{p.speed}</span>
                    {p.noVerify && <span className="ai-set__badge">免认证</span>}
                  </span>
                  <span className={`ai-set__chip${p.ready ? ' is-on' : ''}`}>
                    {p.keyless ? '免 Key' : p.ready ? '已就绪' : '未配置'}
                  </span>
                </div>

                <p className="ai-set__note">
                  {p.gate && <em className="ai-set__gate">〔{p.gate}〕</em>}
                  {p.freeNote}
                </p>

                {!p.keyless && (
                  <div className="ai-set__row">
                    <input
                      id={inputId}
                      className="input ai-set__input"
                      type={show[p.id] ? 'text' : 'password'}
                      value={draft[p.id] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                      placeholder={getKey(p.id) ? '已填写，留空则不修改' : (p.keyHint ?? '粘贴 API Key')}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="ai-set__btn"
                      onClick={() => setShow((s) => ({ ...s, [p.id]: !s[p.id] }))}
                      aria-label={show[p.id] ? '隐藏' : '显示'}
                    >
                      {show[p.id] ? '隐藏' : '显示'}
                    </button>
                    <button type="button" className="ai-set__btn ai-set__btn--main" onClick={() => save(p.id)}>
                      保存
                    </button>
                  </div>
                )}

                <div className="ai-set__foot">
                  {p.keyUrl && (
                    <a className="ai-set__link" href={p.keyUrl} target="_blank" rel="noreferrer">
                      申请 Key ↗
                    </a>
                  )}
                  <button
                    type="button"
                    className="ai-set__link ai-set__link--btn"
                    onClick={() => void runTest(p.id)}
                    disabled={t?.busy || (!p.keyless && !p.ready)}
                  >
                    {t?.busy ? '测试中…' : '测试连通'}
                  </button>
                  {t?.text && (
                    <span className={`ai-set__test${t.ok ? ' is-ok' : ' is-bad'}`}>{t.text}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="ai-set__scroll-hint">
          共 {states.length} 个平台，目录可上下滚动 · 只有一个填了 Key 就够用
        </p>

        {flash && <p className="ai-set__flash">{flash}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            关闭
          </button>
          <button
            type="button"
            className="btn btn--full"
            onClick={() => {
              clearFailed();
              setFlash('已重置失败记录，下次识别会重新尝试所有平台');
              window.setTimeout(() => setFlash(null), 2600);
            }}
          >
            重置尝试记录
          </button>
        </div>
      </div>
    </div>
  );
}
