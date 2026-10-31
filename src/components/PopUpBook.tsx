import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ClayMotif, { motifFor } from './ClayMotif';
import type { WorkItem } from '../types';
import { storySound } from '../utils/sound';

interface PopUpBookProps {
  works: WorkItem[];
  onClose: () => void;
  onOpenWork: (work: WorkItem) => void;
}

/**
 * CSS 3D 纸质立体书（Pop-up Book）。
 *
 * 摒弃平面网格：每页只讲一个成果，页内分三层景深——
 *   前景 translateZ(60px) 课题立牌与立体小花
 *   中景 translateZ(20px) 以底边为折痕轴 rotateX(-88deg) → 0 弹起的照片卡
 *   后景 translateZ(0)    贴在纸面上的坐标卡与页码
 * 翻页时先把纸片折平、再换数据、再弹起，还原真实立体书"一合、一翻、一立"。
 */

type Phase = 'flat' | 'up';
type SheetKind = 'main' | 'detail';

/** 手势翻页阈值（累计位移，px） */
const SWIPE_THRESHOLD = 35;
/** 触屏滑动阈值（手指位移，px） */
const TOUCH_THRESHOLD = 48;
/** 翻页冷却锁：翻页期间丢弃触控板惯性余量，滑一下只翻一页 */
const TURN_LOCK = 820;
/** 纸卡折平所需时间：0.44s 收起 + 第二张 0.11s 错峰，都躺平了才换数据 */
const FLAT_MS = 560;
/** 折平结束后换数据，再等一帧让新页从平躺状态起跑 */
const POP_MS = 90;
/** 两段手势的间隔，超过则视为全新一次滑动 */
const GESTURE_GAP = 260;

/** 竖屏用纵向手势，横屏用横向手势 */
const isPortrait = () =>
  typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches;

/**
 * 事件目标是否处在一个"还能继续滚"的内层滚动块里（例如右页的简介文字）。
 * 是的话让原生滚动先吃满，滚到边界才接管为翻页，避免滑一下就抢走阅读。
 */
function scrollsInside(start: EventTarget | null, root: HTMLElement | null, delta: number) {
  let el = start instanceof HTMLElement ? start : null;
  while (el && el !== root) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2) {
      if (delta > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 2) return true;
      if (delta < 0 && el.scrollTop > 2) return true;
    }
    el = el.parentElement;
  }
  return false;
}

interface Sheet {
  id: string;
  kind: SheetKind;
  /** 立起后的微小角度差，制造两张纸片"错落"的手工感 */
  rot: number;
}

/** 每页两张立体纸卡：主视觉立在正中，局部特写稍后仰、稍小，形成错落 */
function sheetsFor(): Sheet[] {
  return [
    { id: 'main', kind: 'main', rot: 0 },
    { id: 'detail', kind: 'detail', rot: 4.2 },
  ];
}

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

const cityOf = (w: WorkItem) => w.city || w.region.split('·').pop() || w.region;

/* 前景折纸小花，三朵错落站在纸面最前面 */
const FRILLS = [
  { left: '4%', scale: 1, rot: -9, hue: '#f8f3da', core: '#ecc96b' },
  { left: '93%', scale: 0.82, rot: 12, hue: '#fdeef1', core: '#e8a9a4' },
  { left: '12%', scale: 0.6, rot: 5, hue: '#eef4fb', core: '#a9c4dd' },
];

export default function PopUpBook({ works, onClose, onOpenWork }: PopUpBookProps) {
  const total = works.length;
  const pageCount = Math.max(1, total);

  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState<Phase>('flat');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [closing, setClosing] = useState(false);
  const [zoom, setZoom] = useState<Sheet | null>(null);
  const [resOpen, setResOpen] = useState(false);
  /** 屏幕方向：竖屏用上下滑动翻页，横屏用左右滑动翻页 */
  const [portrait, setPortrait] = useState(isPortrait);

  const rafRef = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const busy = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  /** 手势状态机：全部走 ref，滑动的每一帧都不触发重渲染 */
  const gesture = useRef({
    acc: 0, // 本次手势在翻页轴上的累计位移
    last: 0, // 上一个 wheel 事件的时间戳
    lockUntil: 0, // 冷却锁到期时间
    touchX: 0,
    touchY: 0,
  });

  const active = works[Math.min(page, pageCount - 1)];
  const sheets = useMemo(() => (active ? sheetsFor() : []), [active]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  /* 入场：先平躺一帧，再立起，transition 才有起点 */
  useEffect(() => {
    storySound.playPaperTurn();
    document.body.style.overflow = 'hidden';
    later(() => setPhase('up'), 140);
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      document.body.style.overflow = '';
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [later]);

  /* 合拢：纸片折平 → 书本合上 → 遮罩散去 */
  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setPhase('flat');
    setZoom(null);
    storySound.playPaperTurn();
    later(onClose, 560);
  }, [closing, later, onClose]);

  /* 翻页：当前页纸卡折平 → 换数据 → 新页纸卡弹起 */
  const turn = useCallback(
    (dir: 1 | -1) => {
      if (busy.current || closing) return false;
      const next = page + dir;
      if (next < 0 || next >= pageCount) return false;
      busy.current = true;
      // 无论来自滑动、按钮还是键盘，都上同一把锁，惯性余量一律丢弃
      gesture.current.lockUntil = performance.now() + TURN_LOCK;
      gesture.current.acc = 0;
      storySound.playPaperTurn();
      setPhase('flat');
      setZoom(null);
      setResOpen(false);
      later(() => {
        setPage(next);
        later(() => {
          setPhase('up');
          busy.current = false;
        }, POP_MS);
      }, FLAT_MS);
      return true;
    },
    [closing, later, page, pageCount]
  );

  /* 给原生监听器一份"永远最新"的引用，避免每次翻页重挂事件 */
  const live = useRef({ turn, closing, zoomed: false });
  live.current = { turn, closing, zoomed: Boolean(zoom) };

  /* 屏幕方向变了（转屏 / 拖动窗口）要重算提示文案 */
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const onChange = () => setPortrait(mq.matches);
    mq.addEventListener('change', onChange);
    onChange();
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /**
   * 触控板滑动翻页，轴向跟着屏幕方向走：
   *   竖屏 → 双指上下滑动；横屏 → 双指左右滑动。
   *
   * 触控板一次滑动会被拆成几十个 wheel 事件，且松手后还有惯性余量，
   * 所以：先在翻页轴上累计位移、跨过阈值才翻页，翻页瞬间上冷却锁，
   * 惯性余量在锁内只被丢弃、不再触发，保证"滑一下只翻一页"。
   * 位移为正（竖屏双指下滑 / 横屏双指左滑，内容往后走）→ 下一页。
   * 竖屏时右页简介这类内层可滚动文字块先吃满自己的滚动，滚到边界才接管翻页。
   * 非翻页轴的横向手势一律 preventDefault，拦掉浏览器"双指左右滑 → 历史后退"。
   */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const g = gesture.current;

    const onWheel = (e: WheelEvent) => {
      if (live.current.closing || live.current.zoomed) return;

      const now = performance.now();
      if (now - g.last > GESTURE_GAP) g.acc = 0;
      g.last = now;

      // deltaMode: 0 像素 / 1 行 / 2 页 —— 统一折算成像素，Firefox 的行模式才不会失灵
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;

      // 竖屏读上下、横屏读左右；另一根轴上的手势不算翻页
      const vert = isPortrait();
      const main = vert ? dy : dx;
      const cross = vert ? dx : dy;

      // 另一根轴占优：明确不翻页，但截住浏览器手势（历史前进/后退）
      if (Math.abs(cross) > Math.abs(main)) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (Math.abs(main) < 2) return;

      // 竖屏且内层文字块还能继续滚 → 交还原生滚动，不抢
      if (vert && scrollsInside(e.target, el, dy)) return;

      // 接管这一帧：顺手吃掉橡皮筋回弹
      if (e.cancelable) e.preventDefault();

      if (now < g.lockUntil) return; // 冷却中：惯性余量直接丢弃

      g.acc += main;
      if (Math.abs(g.acc) < SWIPE_THRESHOLD) return;

      const dir: 1 | -1 = g.acc > 0 ? 1 : -1; // 内容往后走 → 下一页
      g.acc = 0;
      live.current.turn(dir);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (live.current.closing || live.current.zoomed) return;
      const t = e.touches[0];
      if (!t) return;
      g.touchX = t.clientX;
      g.touchY = t.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (live.current.closing || live.current.zoomed) return;
      const t = e.touches[0];
      if (!t || e.touches.length > 1) return;
      const dx = t.clientX - g.touchX;
      const dy = t.clientY - g.touchY;
      const vert = isPortrait();
      const main = vert ? dy : dx;
      const cross = vert ? dx : dy;
      // 翻页轴上的拖动吃掉默认行为，防止 iOS 边缘返回与橡皮筋；另一根轴留给原生滚动
      if (Math.abs(main) > Math.abs(cross) && Math.abs(main) > 8 && e.cancelable) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (live.current.closing || live.current.zoomed) return;
      if (performance.now() < g.lockUntil) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - g.touchX;
      const dy = t.clientY - g.touchY;
      const vert = isPortrait();
      const main = vert ? dy : dx;
      const cross = vert ? dx : dy;
      if (vert && scrollsInside(e.target, el, dy)) return;
      if (Math.abs(main) > Math.abs(cross) && Math.abs(main) > TOUCH_THRESHOLD) {
        // 手指把内容往"后"推：竖屏上滑、横屏左滑 → 下一页
        live.current.turn(main < 0 ? 1 : -1);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  /* 键盘：← → 翻页，Esc 合上 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') turn(-1);
      else if (e.key === 'ArrowRight') turn(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, turn]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      // rotateY 落在 ±5°，rotateX 落在 16°~22°，都在规范的视差区间里
      setTilt({ x: -ny * 6, y: nx * 10 });
    });
  };

  const onLeave = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTilt({ x: 0, y: 0 });
  };

  if (!active) {
    return (
      <div
        ref={rootRef}
        className="veil veil--album"
        role="dialog"
        aria-modal="true"
        aria-label="学生成果展示"
      >
        <div className="pop3d pop3d--empty">
          <p className="prose">这本相册还空着，等着第一份成果落钉。</p>
        </div>
        <button type="button" className="pop3d__close" onClick={close}>
          <CloseGlyph />
          <span>合上相册</span>
        </button>
      </div>
    );
  }

  const motif = motifFor(active.title);
  const up = phase === 'up' && !closing;

  const resources = [
    { key: 'pdf', name: '成果手抄报', hint: 'PDF', url: active.digitalResourceUrl },
    { key: 'video', name: '探究过程短片', hint: 'MP4', url: active.videoUrl },
    { key: 'deck', name: '小组汇报幻灯片', hint: 'PPTX', url: active.digitalResourceUrl },
    { key: 'img', name: '成果高清图', hint: 'PNG', url: active.imageUrl },
  ];

  return (
    <div
      ref={rootRef}
      className={`veil veil--album${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="学生成果展示 · 立体书"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <button type="button" className="pop3d__close" onClick={close} aria-label="合上相册">
        <CloseGlyph />
        <span>合上相册</span>
      </button>

      {/* ---------- 3D 舞台 ---------- */}
      <div className="pop3d" onMouseMove={onMove} onMouseLeave={onLeave}>
        <div className="pop3d__stage">
          <div
            className={`pop3d__book${closing ? ' is-closing' : ''}`}
            style={{
              transform: `rotateX(${19 + tilt.x}deg) rotateY(${tilt.y}deg)`,
            }}
          >
            {/* ============ 左页：立体舞台 ============ */}
            <section className="pop3d__leaf pop3d__leaf--l">
              <div className="pop3d__deck">
                {/* 后景 translateZ(0)：半立起的背板，纸卡就从它前面弹起来 */}
                <div className="pop3d__backdrop" aria-hidden="true">
                  <span className="pop3d__backdrop-mark">行智开物 · 学生成果</span>
                </div>

                {/* 后景 translateZ(0)：贴在纸面上的坐标卡 */}
                <div className="pop3d__back" key={`back-${active.id}`}>
                  <span className="pop3d__coord">
                    <PinGlyph />
                    童眼看 · {cityOf(active)}
                  </span>
                  <span className="pop3d__folium">成果 · {active.date}</span>
                </div>

                {/* 中景 translateZ(20px)：以底边为轴弹起的纸卡 */}
                <div className="pop3d__row">
                  {sheets.map((s, i) => (
                    <div
                      key={`${active.id}-${s.id}`}
                      className={`pop3d__slot pop3d__slot--${s.kind}${up ? ' is-up' : ''}`}
                      style={{ ['--i' as string]: i, ['--rot' as string]: `${s.rot}deg` }}
                    >
                      {/* 折痕：贴在地面，随立起角度加深 */}
                      <span className="pop3d__crease" aria-hidden="true" />
                      {/* 纸片投在衬纸上的影：立起越高，影子越长 */}
                      <span className="pop3d__cast" aria-hidden="true" />

                      <button
                        type="button"
                        className="pop3d__card"
                        onClick={() => {
                          storySound.playPinDrop();
                          setZoom(s);
                        }}
                        aria-label="放大查看成果画面"
                      >
                        {/* 侧边露出的三角折页支架 */}
                        <span className="pop3d__fold pop3d__fold--l" aria-hidden="true" />
                        <span className="pop3d__fold pop3d__fold--r" aria-hidden="true" />

                        <span className="pop3d__face">
                          <SheetFace work={active} sheet={s} motif={motif} />
                        </span>

                        <span className="pop3d__shade" aria-hidden="true" />
                        <span className="pop3d__lift" aria-hidden="true">
                          放大
                        </span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* 前景 translateZ(60px)：课题立牌 + 立体剪纸小花 */}
                <div className="pop3d__front">
                  <span className="pop3d__plate">
                    <span className="pop3d__plate-t">{active.title}</span>
                  </span>

                  {FRILLS.map((f, i) => (
                    <svg
                      key={i}
                      className="pop3d__frill"
                      viewBox="0 0 40 54"
                      aria-hidden="true"
                      style={{
                        left: f.left,
                        transform: `translateX(-50%) translateZ(60px) rotate(${f.rot}deg) scale(${f.scale})`,
                      }}
                    >
                      <path
                        d="M20 54 C 20 44 20 34 20 26"
                        stroke="#7fa962"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                      {[0, 72, 144, 216, 288].map((deg) => (
                        <ellipse
                          key={deg}
                          cx="20"
                          cy="15"
                          rx="5"
                          ry="7.6"
                          fill={f.hue}
                          stroke="#e7e1d0"
                          strokeWidth="0.8"
                          transform={`rotate(${deg} 20 21)`}
                        />
                      ))}
                      <circle cx="20" cy="21" r="3.6" fill={f.core} />
                    </svg>
                  ))}
                </div>
              </div>
            </section>

            <div className="pop3d__gutter" aria-hidden="true" />

            {/* ============ 右页：信息层 ============ */}
            <section className="pop3d__leaf pop3d__leaf--r">
              <div className="pop3d__info" key={`info-${active.id}`}>
                <span className="pop3d__mark">学生成果 · Student Work</span>

                <h2 className="pop3d__title">{active.title}</h2>

                <p className="pop3d__by">
                  <span className="pop3d__who">{active.author}</span>
                  <span className="pop3d__sep" aria-hidden="true" />
                  <span className="pop3d__school">{active.school}</span>
                </p>

                <div className="pop3d__facts">
                  <span className="pop3d__fact">
                    <PinGlyph />
                    童眼看 · {cityOf(active)}
                  </span>
                  <span className="pop3d__fact tnum">{active.date}</span>
                </div>

                <div className="pop3d__brief no-scrollbar">
                  <p className="pop3d__desc">{clip(active.content, 235)}</p>
                  <p className="pop3d__kws">
                    {motifLabel(motif)} · {active.province} · {active.district}
                  </p>
                </div>

                {active.comments.slice(0, 2).map((c) => (
                  <figure className="pop3d__quote" key={c.id}>
                    <span className="pop3d__quote-mark" aria-hidden="true" />
                    <blockquote className="pop3d__quote-t">{clip(c.text, 52)}</blockquote>
                    <figcaption className="pop3d__quote-by">{c.user}</figcaption>
                  </figure>
                ))}

                <div className="pop3d__foot">
                  <div className="pop3d__stats tnum">
                    <span>赞 {active.likes}</span>
                    <span>评 {active.comments.length}</span>
                    <span>{motifLabel(motif)}</span>
                  </div>

                  <button
                    type="button"
                    className={`pop3d__pack${resOpen ? ' is-open' : ''}`}
                    onClick={() => {
                      storySound.playChime();
                      setResOpen((v) => !v);
                    }}
                    aria-expanded={resOpen}
                  >
                    <BoxGlyph />
                    <span>查看 / 下载数字资源包</span>
                    <span className="pop3d__pack-caret" aria-hidden="true" />
                  </button>

                  {resOpen && (
                    <ul className="pop3d__resources">
                      {resources.map((r) => {
                        const ready = Boolean(r.url && r.url !== '#download');
                        return (
                          <li key={r.key}>
                            <a
                              className={`pop3d__resource${ready ? '' : ' is-off'}`}
                              href={ready ? r.url : undefined}
                              target="_blank"
                              rel="noreferrer noopener"
                              onClick={(e) => {
                                if (!ready) {
                                  e.preventDefault();
                                  storySound.playPinSnap();
                                }
                              }}
                            >
                              <span className="pop3d__resource-name">{r.name}</span>
                              <span className="pop3d__resource-hint">
                                {ready ? r.hint : '待上传'}
                              </span>
                            </a>
                          </li>
                        );
                      })}
                      <li>
                        <button
                          type="button"
                          className="pop3d__resource pop3d__resource--open"
                          onClick={() => onOpenWork(active)}
                        >
                          <span className="pop3d__resource-name">打开完整成果页</span>
                          <span className="pop3d__resource-hint">详情</span>
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ---------- 翻页控制 ---------- */}
        <div className="pop3d__nav">
          <button
            type="button"
            className="pop3d__turn"
            onClick={() => turn(-1)}
            disabled={page <= 0}
            aria-label="上一页"
          >
            <span aria-hidden="true">←</span> 上一页
          </button>

          <div className="pop3d__pager-wrap">
            <div className="pop3d__pager" aria-label="页码">
              <span className="pop3d__pager-now tnum">{page + 1}</span>
              <span className="pop3d__pager-line" aria-hidden="true">
                <span
                  className="pop3d__pager-fill"
                  style={{ transform: `scaleX(${(page + 1) / pageCount})` }}
                />
              </span>
              <span className="pop3d__pager-all tnum">{pageCount}</span>
            </div>
            <span className="pop3d__hint">
              {portrait ? '支持触控板双指上下滑动翻页' : '支持触控板双指左右滑动翻页'}
            </span>
          </div>

          <button
            type="button"
            className="pop3d__turn"
            onClick={() => turn(1)}
            disabled={page >= pageCount - 1}
            aria-label="下一页"
          >
            下一页 <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      {/* ---------- 单张放大 ---------- */}
      {zoom && (
        <div
          className="pop3d__zoom"
          role="dialog"
          aria-modal="true"
          aria-label="成果画面放大"
          onClick={() => setZoom(null)}
        >
          <div className="pop3d__zoom-inner" onClick={(e) => e.stopPropagation()}>
            <div className="pop3d__zoom-media">
              {active.imageUrl ? (
                <img src={active.imageUrl} alt={active.title} />
              ) : (
                <ClayMotif kind={motif} />
              )}
            </div>
            <div className="pop3d__zoom-bar">
              <span className="pop3d__zoom-cap">{active.title}</span>
              <span className="pop3d__zoom-actions">
                <button type="button" className="btn btn--quiet" onClick={() => onOpenWork(active)}>
                  完整成果页
                </button>
                <button type="button" className="btn btn--quiet" onClick={() => setZoom(null)}>
                  收起
                </button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 纸卡内容 ---------------- */

function SheetFace({
  work,
  sheet,
  motif,
}: {
  work: WorkItem;
  sheet: Sheet;
  motif: ReturnType<typeof motifFor>;
}) {
  if (sheet.kind === 'detail') {
    return (
      <span className="pop3d__media pop3d__media--zoom">
        {work.imageUrl ? (
          <img src={work.imageUrl} alt="" />
        ) : (
          <span className="pop3d__motif pop3d__motif--zoom">
            <ClayMotif kind={motif} />
          </span>
        )}
        <span className="pop3d__tag">局部特写</span>
      </span>
    );
  }

  return (
    <span className="pop3d__media">
      {work.imageUrl ? (
        <img src={work.imageUrl} alt={`${work.title} 的成果画面`} />
      ) : (
        <ClayMotif kind={motif} />
      )}
    </span>
  );
}

/* ---------------- 小图标 ---------------- */

function CloseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PinGlyph() {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
      <path
        d="M5 11.2C5 11.2 9.2 7.3 9.2 4.4A4.2 4.2 0 1 0 .8 4.4C.8 7.3 5 11.2 5 11.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <circle cx="5" cy="4.4" r="1.5" fill="currentColor" />
    </svg>
  );
}

function BoxGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.4 14.2 4.6v6.8L8 14.6 1.8 11.4V4.6L8 1.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M1.8 4.6 8 7.8l6.2-3.2M8 7.8v6.8" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function motifLabel(kind: ReturnType<typeof motifFor>) {
  const map: Record<string, string> = {
    bamboo: '竹林观察',
    flower: '水生植物',
    tree: '古树年轮',
    citrus: '柑橘蜜源',
    feather: '羽色色谱',
    seed: '种子萌发',
  };
  return map[kind] ?? '自然笔记';
}
