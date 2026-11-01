/**
 * 父子品牌协同导航栏
 * 对应方案 4.3（原 HeaderNav.vue）：
 * 顶部明确展示「行智开物 · 课题组 | 童眼看世界 Pupils' Eyes」的联合品牌关系，
 * 图形标识延续主站双叶/双瓣几何轮廓。
 */

/** 行智开物主平台大厅（方案 4.3 给定的回跳地址） */
const XINGZHI_HOME = 'http://121.41.179.150/xing/';

type Props = {
  /** 关闭工作台，回到 3D 课桌场景 */
  onClose: () => void;
};

export default function HeaderNav({ onClose }: Props) {
  const returnToMainPlatform = () => {
    window.location.href = XINGZHI_HOME;
  };

  return (
    <header className="xzh">
      <div className="xzh__brand">
        <div className="xzh__logo">
          <svg viewBox="0 0 32 32" fill="none" className="xzh__svg" aria-hidden="true">
            <defs>
              <linearGradient
                id="xzh-logo-grad"
                x1="4"
                y1="4"
                x2="28"
                y2="28"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#6366F1" />
                <stop offset="1" stopColor="#A885FF" />
              </linearGradient>
            </defs>
            <path
              d="M16 4C10 4 4 10 4 16C4 22 10 28 16 28C22 28 28 22 28 16"
              stroke="url(#xzh-logo-grad)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="16" cy="16" r="5" fill="url(#xzh-logo-grad)" />
          </svg>
        </div>

        <div className="xzh__titles">
          <div className="xzh__parent">行智开物 · 课题组</div>
          <div className="xzh__sub">
            童眼看世界 <span className="xzh__en">Pupils' Eyes</span>
          </div>
        </div>
      </div>

      <nav className="xzh__actions">
        <div className="xzh__sync">
          <span className="xzh__dot" aria-hidden="true" />
          <span>主平台数据已联通</span>
        </div>

        <button
          type="button"
          className="toon-btn toon-btn-ghost toon-btn--sm"
          onClick={returnToMainPlatform}
        >
          返回主平台大厅
        </button>

        <button type="button" className="toon-btn toon-btn-pink toon-btn--sm" onClick={onClose}>
          返回课桌
        </button>

        <div className="xzh__user">
          <span className="xzh__avatar" aria-hidden="true">👦</span>
          <span className="xzh__uname">探究者 · 溧阳试点班</span>
        </div>
      </nav>
    </header>
  );
}
