/**
 * 人机四维打磨工作台
 * 落实【开物】段——按「找茬（裁判）、学到（学生）、激发（伙伴）、反观（镜子）」
 * 四个视角走完一轮，四维具全才算真正的人机协同。
 *
 * 视觉：绘本晨曦 · 赛璐璐黏土。四块墨线方块各带一枚彩色贴纸章，
 * 裁判=暖日黄、学生=地中海蓝、伙伴=菲亚特粉、镜子=鼠尾草绿。
 */
import { useState } from 'react';
import { useTilt } from '../utils/useTilt';

type DimKey = 'critique' | 'learned' | 'inspired' | 'reflection';

type Dim = {
  key: DimKey;
  badge: string;
  aim: string;
  placeholder: string;
  mod: string;
  /** 贴纸章里的一个字，比图标更贴绘本排版 */
  stamp: string;
};

const DIMS: Dim[] = [
  {
    key: 'critique',
    badge: '找茬 · 裁判视角',
    aim: '挑错修正，防盲信对抗幻觉',
    placeholder: 'AI 哪里不对、不像、缺乏真实细节？',
    mod: 'is-referee',
    stamp: '裁',
  },
  {
    key: 'learned',
    badge: '学到 · 学生视角',
    aim: '吸收新知，核验真伪后吸收',
    placeholder: '从 AI 的回答里发现了哪些之前不知道的知识点？',
    mod: 'is-student',
    stamp: '学',
  },
  {
    key: 'inspired',
    badge: '激发 · 伙伴视角',
    aim: '跳出局限，碰撞出新灵感',
    placeholder: '哪个点让你眼前一亮？你打算在上面叠加什么新创意？',
    mod: 'is-partner',
    stamp: '激',
  },
  {
    key: 'reflection',
    badge: '反观 · 镜子视角',
    aim: '照见自我，反思思路与进步',
    placeholder: '我的指令哪里表达得还不够准？相比上一轮更通透了吗？',
    mod: 'is-mirror',
    stamp: '镜',
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
const LEVELS = [
  '观察者（尚未动笔）',
  '初探者（单维起步）',
  '协作者（双维并进）',
  '同行者（三维贯通）',
  '驾驭者（四维具全）',
];

type Props = {
  /** 同步到主平台资产包 */
  onSync: (filled: number) => void;
};

export default function FourDimRefine({ onSync }: Props) {
  const [data, setData] = useState<Record<DimKey, string>>(INITIAL);
  const tiltRef = useTilt<HTMLDivElement>(1.4);

  const filled = DIMS.filter((d) => data[d.key].trim().length > 0).length;
  const level = LEVELS[filled];

  return (
    <div className="toon-clay-card fdr" ref={tiltRef}>
      <div>
        <div className="vintage-badge vintage-badge--sage">【开物】人机四维打磨</div>
        <h3 className="comic-title">作品进化舱：人与 AI 的协同打磨</h3>
        <p className="subtitle">四维合一才是真正的人机协同，记录你的每一步思考。</p>
      </div>

      <div className="dim-grid">
        {DIMS.map((dim) => (
          <div key={dim.key} className={`dim-block ${dim.mod}`}>
            <div className="dim-block__cap">
              <span className="dim-chip" aria-hidden="true">{dim.stamp}</span>
              <span className="dim-badge">{dim.badge}</span>
            </div>
            <div className="dim-aim">{dim.aim}</div>
            <textarea
              className="dim-area"
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
          当前协同段位：
          <span className="level-chip">{level}</span>
          <span className="level-count tnum">{filled}/4 维</span>
        </div>

        <button
          type="button"
          className="toon-btn toon-btn-pink"
          onClick={() => onSync(filled)}
        >
          一键同步成果至主平台资产包
        </button>
      </div>
    </div>
  );
}
