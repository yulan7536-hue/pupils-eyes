/**
 * 具身感知 · 感官打捞工作台
 * 落实【行】段——走出屏幕去触摸真实的竹叶、嗅闻清晨泥土，
 * 再用童眼把第一手体验打捞成一张「感官取景框」。
 *
 * 视觉：绘本晨曦 · 赛璐璐黏土。四个感官各是一块带墨线与实体切面的黏土方块，
 * 选中时整块被"按下去"（位移 2px、阴影同步吃掉 2px），像软胶一样回弹。
 */
import { useState } from 'react';
import { useTilt } from '../utils/useTilt';

type SenseType = 'sight' | 'touch' | 'sound' | 'smell';

type SenseItem = {
  type: SenseType;
  label: string;
  icon: string;
  /** 赛璐璐色块：蓝=所见、粉=触觉、黄=声响、绿=气味 */
  colorClass: string;
  value: string;
};

const INITIAL_ITEMS: SenseItem[] = [
  {
    type: 'sight',
    label: '童眼所见',
    icon: '👀',
    colorClass: 'clay-blue',
    value: '晨光穿透绿叶的光斑',
  },
  {
    type: 'touch',
    label: '指尖触碰',
    icon: '🖐️',
    colorClass: 'clay-pink',
    value: '竹枝边缘微微扎手的毛糙',
  },
  {
    type: 'sound',
    label: '侧耳倾听',
    icon: '👂',
    colorClass: 'clay-yellow',
    value: '风吹过林梢沙沙的响声',
  },
  {
    type: 'smell',
    label: '空气气味',
    icon: '👃',
    colorClass: 'clay-sage',
    value: '带露水的泥土与青草甘香',
  },
];

const PRESETS: Record<SenseType, string[]> = {
  sight: ['斑驳光影', '毛糙边缘', '透亮淡绿', '晨雾朦胧'],
  touch: ['像旧砂纸', '冰凉湿润', '凹凸不平', '温润微滑'],
  sound: ['沙沙细响', '清脆如铃', '断断续续', '嗡嗡微鸣'],
  smell: ['雨后青草', '微苦泥香', '清甜竹气', '日晒干燥'],
};

export default function SensoryHarvest() {
  const [items, setItems] = useState<SenseItem[]>(INITIAL_ITEMS);
  const [activeType, setActiveType] = useState<SenseType>('touch');
  const tiltRef = useTilt<HTMLDivElement>(2);

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
    <div className="toon-clay-card shv" ref={tiltRef}>
      <div>
        <div className="vintage-badge">【行】感官前置打捞</div>
        <h3 className="comic-title">童眼看世界 · 感官取景框</h3>
        <p className="subtitle">走出屏幕去触摸真实的竹叶、嗅闻清晨泥土，再用童眼记录下来。</p>
      </div>

      <div className="senses-grid">
        {items.map((item) => (
          <button
            type="button"
            key={item.type}
            className={`clay-block ${item.colorClass}${activeType === item.type ? ' is-active' : ''}`}
            onClick={() => setActiveType(item.type)}
            aria-pressed={activeType === item.type}
          >
            <span className="block-cap">
              <span className="block-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </span>
            <span className="block-preview">{item.value || '待打捞...'}</span>
          </button>
        ))}
      </div>

      <div className="input-slot">
        <div className="slot-label">正在记录【{activeItem?.label}】：</div>

        <div className="preset-pills">
          {currentPresets.map((tag) => (
            <button type="button" key={tag} className="tag-pill" onClick={() => addTag(tag)}>
              + {tag}
            </button>
          ))}
        </div>

        <input
          className="toon-input"
          value={activeValue}
          onChange={(e) => setActiveValue(e.target.value)}
          placeholder="记录摸到的粗糙、清晨风里的草木气味..."
          aria-label={`记录${activeItem?.label ?? ''}`}
        />
      </div>
    </div>
  );
}
