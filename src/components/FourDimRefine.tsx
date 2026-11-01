/**
 * 人机四维打磨工作台
 * 对应方案 4.5（原 FourDimRefine.vue）：
 * 落实【开物】段——按「找茬（裁判）、学到（学生）、激发（伙伴）、反观（镜子）」
 * 四个视角走完一轮，四维具全才算真正的人机协同。
 */
import { useState } from 'react';

type DimKey = 'critique' | 'learned' | 'inspired' | 'reflection';

type Dim = {
  key: DimKey;
  badge: string;
  aim: string;
  placeholder: string;
  mod: string;
};

const DIMS: Dim[] = [
  {
    key: 'critique',
    badge: '找茬 · 裁判视角',
    aim: '挑错修正，防盲信对抗幻觉',
    placeholder: 'AI 哪里不对、不像、缺乏真实细节？',
    mod: 'is-referee',
  },
  {
    key: 'learned',
    badge: '学到 · 学生视角',
    aim: '吸收新知，核验真伪后吸收',
    placeholder: '从 AI 的回答里发现了哪些之前不知道的知识点？',
    mod: 'is-student',
  },
  {
    key: 'inspired',
    badge: '激发 · 伙伴视角',
    aim: '跳出局限，碰撞出新灵感',
    placeholder: '哪个点让你眼前一亮？你打算在上面叠加什么新创意？',
    mod: 'is-partner',
  },
  {
    key: 'reflection',
    badge: '反观 · 镜子视角',
    aim: '照见自我，反思思路与进步',
    placeholder: '我的指令哪里表达得还不够准？相比上一轮更通透了吗？',
    mod: 'is-mirror',
  },
];

/** 初始示例沿用方案原文，等同于一次完整的示范轮 */
const INITIAL: Record<DimKey, string> = {
  critique: 'AI 生出的竹叶没有表现出早晨带露水的沉坠感，结构略显死板。',
  learned: 'AI 提醒我当地竹编有"经纬穿插"的特定织法，这个冷知识可以融进画里。',
  inspired: '可以在竹林背景里加上童眼特写的小蜗牛，形成微观与宏观的视角反差。',
  reflection: '第一轮我只写了"画一片竹林"，第二轮我加入了指尖触感和晨光细节，表达更精准了。',
};

/** 段位按真实填写数量算，而不是写死——否则空表也显示「驾驭者」 */
const LEVELS = ['观察者（尚未动笔）', '初探者（单维起步）', '协作者（双维并进）', '同行者（三维贯通）', '驾驭者（四维具全）'];

type Props = {
  /** 同步到主平台资产包 */
  onSync: (filled: number) => void;
};

export default function FourDimRefine({ onSync }: Props) {
  const [data, setData] = useState<Record<DimKey, string>>(INITIAL);

  const filled = DIMS.filter((d) => data[d.key].trim().length > 0).length;
  const level = LEVELS[filled];

  return (
    <div className="xz-glass-card fdr">
      <div className="fdr__head">
        <div className="fdr__tag">【开物】人机四维打磨</div>
        <h3 className="fdr__title">作品进化舱：人与 AI 的协同打磨</h3>
        <p className="fdr__sub">四维合一才是真正的人机协同，记录你的每一步思考。</p>
      </div>

      <div className="fdr__grid">
        {DIMS.map((dim) => (
          <div key={dim.key} className={`fdr__block ${dim.mod}`}>
            <div className="fdr__badge">{dim.badge}</div>
            <div className="fdr__aim">{dim.aim}</div>
            <textarea
              className="fdr__area"
              value={data[dim.key]}
              onChange={(e) => setData((prev) => ({ ...prev, [dim.key]: e.target.value }))}
              placeholder={dim.placeholder}
              aria-label={dim.badge}
            />
          </div>
        ))}
      </div>

      <div className="fdr__footer">
        <div className="fdr__level">
          当前协同段位：<span className="fdr__level-tag">{level}</span>
          <span className="fdr__count tnum">{filled}/4 维</span>
        </div>

        <button
          type="button"
          className="xz-pill-btn xz-pill-btn-primary"
          onClick={() => onSync(filled)}
        >
          一键同步成果至主平台资产包
        </button>
      </div>
    </div>
  );
}
