/**
 * 具身感知 · 感官打捞工作台
 * 对应方案 4.4（原 SensoryHarvest.vue）：
 * 落实【行】段——断网纸笔体验之后，把看/听/摸/闻的第一手体验
 * 打捞成结构化的「感官地图」，为后面的创作提供灵感来源。
 */
import { useState } from 'react';

type SenseType = 'sight' | 'touch' | 'sound' | 'smell';

type SenseItem = {
  type: SenseType;
  label: string;
  icon: string;
  value: string;
};

/** 初始值沿用方案示例（竹林观察记），教师可整条改写 */
const INITIAL_ITEMS: SenseItem[] = [
  { type: 'sight', label: '童眼所见', icon: '👀', value: '晨光穿过竹林的深浅绿影' },
  { type: 'touch', label: '指尖触觉', icon: '🖐️', value: '竹节边缘有细微毛糙感' },
  { type: 'sound', label: '耳边声响', icon: '👂', value: '风吹叶尖沙沙作响' },
  { type: 'smell', label: '空气气息', icon: '👃', value: '潮湿泥土混合新笋清香' },
];

/** 快捷词库：给说不出话的孩子一个台阶 */
const PRESETS: Record<SenseType, string[]> = {
  sight: ['斑驳光影', '粗粝纹理', '晨雾朦胧', '透亮翠绿'],
  touch: ['冰凉湿润', '凹凸不平', '像旧砂纸', '温热平滑'],
  sound: ['清脆如铃', '低沉嗡鸣', '断断续续', '沙沙细响'],
  smell: ['微苦草木', '甘甜果香', '雨后泥腥', '日晒干燥'],
};

export default function SensoryHarvest() {
  const [items, setItems] = useState<SenseItem[]>(INITIAL_ITEMS);
  const [activeType, setActiveType] = useState<SenseType>('touch');

  const activeItem = items.find((i) => i.type === activeType);
  const activeValue = activeItem?.value ?? '';
  const currentPresets = PRESETS[activeType];

  const setActiveValue = (val: string) => {
    setItems((prev) => prev.map((i) => (i.type === activeType ? { ...i, value: val } : i)));
  };

  /** 追加到已有描述后面，用顿号连接，避免覆盖孩子刚写下的词 */
  const addTag = (tag: string) => {
    setActiveValue(activeValue ? `${activeValue}、${tag}` : tag);
  };

  return (
    <div className="xz-glass-card shv">
      <div className="shv__head">
        <div className="shv__tag">【行】感官前置打捞</div>
        <h3 className="shv__title">童眼观察记：我的感官地图</h3>
        <p className="shv__sub">先用眼睛观察、双手触碰，再把第一手体验转化为创作灵感。</p>
      </div>

      <div className="shv__grid">
        {items.map((item) => (
          <button
            type="button"
            key={item.type}
            className={`shv__card${activeType === item.type ? ' is-active' : ''}`}
            onClick={() => setActiveType(item.type)}
            aria-pressed={activeType === item.type}
          >
            <span className="shv__icon" aria-hidden="true">{item.icon}</span>
            <div className="shv__label">{item.label}</div>
            <div className={`shv__val${item.value ? '' : ' is-empty'}`}>
              {item.value || '点击补充感知...'}
            </div>
          </button>
        ))}
      </div>

      <div className="shv__input-group">
        <label className="shv__input-label" htmlFor="shv-input">
          正在打捞【{activeItem?.label}】的感觉：
        </label>

        <div className="shv__tags">
          {currentPresets.map((tag) => (
            <button type="button" key={tag} className="shv__chip" onClick={() => addTag(tag)}>
              + {tag}
            </button>
          ))}
        </div>

        <input
          id="shv-input"
          className="shv__input"
          value={activeValue}
          onChange={(e) => setActiveValue(e.target.value)}
          placeholder="用具体的词语描述，例如：带着毛边、有泥土微酸的清冽..."
        />
      </div>
    </div>
  );
}
