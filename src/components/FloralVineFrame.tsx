import React from 'react';

/**
 * 屏幕【上方、左侧、右侧】边缘长满鲜花的藤蔓画框式生态装饰
 * 纯画框装饰（不是门！），营造“秘密小空间”基地的自然包裹感
 */
export default function FloralVineFrame() {
  return (
    <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden select-none">
      {/* 顶部藤蔓花环 (Top Floral Vine Border) */}
      <svg
        className="absolute top-0 left-0 w-full h-24 sm:h-32 text-[#2D5A27] drop-shadow-[0_4px_8px_rgba(18,40,24,0.15)]"
        viewBox="0 0 1440 120"
        fill="none"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="vineStemTop" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#255227" />
            <stop offset="50%" stopColor="#3B743B" />
            <stop offset="100%" stopColor="#255227" />
          </linearGradient>
          <linearGradient id="leafGradTop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#559957" />
            <stop offset="100%" stopColor="#245124" />
          </linearGradient>
          <linearGradient id="flowerRoseTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF9AA2" />
            <stop offset="100%" stopColor="#E05768" />
          </linearGradient>
          <linearGradient id="flowerYellowTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF176" />
            <stop offset="100%" stopColor="#F5B041" />
          </linearGradient>
        </defs>

        {/* 主藤条 1 */}
        <path
          d="M-20,15 Q180,55 360,25 T720,38 T1080,22 T1460,35"
          stroke="url(#vineStemTop)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        {/* 细分支藤条 2 */}
        <path
          d="M0,5 Q240,65 520,35 T980,48 T1440,15"
          stroke="#427845"
          strokeWidth="3.5"
          fill="none"
          strokeDasharray="400, 0"
        />

        {/* 顶部下垂的自然卷须与小叶簇 */}
        {/* 左侧簇 */}
        <path d="M60,25 Q75,65 50,85 Q40,95 25,80" stroke="#3A6C3C" strokeWidth="2" fill="none" />
        <path d="M120,35 Q145,75 160,50 Q170,35 150,25" stroke="#3A6C3C" strokeWidth="2" fill="none" />
        <ellipse cx="60" cy="55" rx="14" ry="7" transform="rotate(-35 60 55)" fill="url(#leafGradTop)" />
        <ellipse cx="80" cy="40" rx="16" ry="8" transform="rotate(25 80 40)" fill="#448046" />
        <ellipse cx="140" cy="55" rx="15" ry="7" transform="rotate(45 140 55)" fill="url(#leafGradTop)" />

        {/* 中左花朵与叶片 */}
        <circle cx="210" cy="38" r="9" fill="url(#flowerRoseTop)" />
        <circle cx="210" cy="38" r="4" fill="#FFF275" />
        <ellipse cx="230" cy="30" rx="15" ry="7" transform="rotate(-20 230 30)" fill="url(#leafGradTop)" />
        <ellipse cx="280" cy="42" rx="18" ry="8" transform="rotate(15 280 42)" fill="#3B733D" />

        <circle cx="340" cy="32" r="10" fill="url(#flowerYellowTop)" />
        <circle cx="340" cy="32" r="4" fill="#D35400" />
        <ellipse cx="365" cy="40" rx="16" ry="8" transform="rotate(-30 365 40)" fill="url(#leafGradTop)" />

        {/* 中间簇 */}
        <ellipse cx="680" cy="35" rx="16" ry="8" transform="rotate(-15 680 35)" fill="url(#leafGradTop)" />
        <circle cx="720" cy="38" r="11" fill="url(#flowerRoseTop)" />
        <circle cx="720" cy="38" r="5" fill="#FFF176" />
        <ellipse cx="755" cy="32" rx="15" ry="7" transform="rotate(25 755 32)" fill="#427A45" />

        {/* 中右花朵 */}
        <circle cx="890" cy="36" r="10" fill="url(#flowerYellowTop)" />
        <circle cx="890" cy="36" r="4" fill="#E67E22" />
        <ellipse cx="920" cy="42" rx="17" ry="8" transform="rotate(-25 920 42)" fill="url(#leafGradTop)" />

        <circle cx="1060" cy="28" r="11" fill="url(#flowerRoseTop)" />
        <circle cx="1060" cy="28" r="5" fill="#FFF176" />
        <ellipse cx="1090" cy="32" rx="15" ry="7" transform="rotate(30 1090 32)" fill="url(#leafGradTop)" />

        {/* 右侧簇 */}
        <ellipse cx="1220" cy="34" rx="16" ry="8" transform="rotate(-20 1220 34)" fill="#3B743E" />
        <circle cx="1270" cy="36" r="10" fill="url(#flowerYellowTop)" />
        <circle cx="1270" cy="36" r="4" fill="#D35400" />
        <ellipse cx="1320" cy="40" rx="18" ry="8" transform="rotate(20 1320 40)" fill="url(#leafGradTop)" />
        <path d="M1360,30 Q1385,75 1410,50 Q1420,35 1400,20" stroke="#3A6C3C" strokeWidth="2" fill="none" />
      </svg>

      {/* 左侧垂直藤蔓花架 (Left Border Floral Vines) */}
      <svg
        className="absolute top-0 left-0 w-20 sm:w-28 h-full text-[#2D5A27] drop-shadow-[2px_0_6px_rgba(18,40,24,0.15)]"
        viewBox="0 0 100 800"
        fill="none"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="vineStemLeft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#255227" />
            <stop offset="50%" stopColor="#3C753E" />
            <stop offset="100%" stopColor="#245124" />
          </linearGradient>
          <linearGradient id="flowerPinkLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFB6C1" />
            <stop offset="100%" stopColor="#E75480" />
          </linearGradient>
        </defs>

        <path
          d="M18,0 Q35,160 12,320 T30,520 T15,800"
          stroke="url(#vineStemLeft)"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />

        {/* 错落的鲜花与叶片 */}
        <ellipse cx="28" cy="90" rx="14" ry="7" transform="rotate(35 28 90)" fill="#4B8B4E" />
        <circle cx="16" cy="140" r="9" fill="url(#flowerPinkLeft)" />
        <circle cx="16" cy="140" r="4" fill="#FFF176" />

        <ellipse cx="32" cy="220" rx="15" ry="8" transform="rotate(-25 32 220)" fill="#366D39" />
        <ellipse cx="14" cy="270" rx="13" ry="6" transform="rotate(40 14 270)" fill="#549A57" />
        <circle cx="26" cy="330" r="10" fill="#FFD54F" />
        <circle cx="26" cy="330" r="4" fill="#E65100" />

        <ellipse cx="28" cy="420" rx="16" ry="8" transform="rotate(20 28 420)" fill="#448447" />
        <circle cx="18" cy="480" r="9" fill="url(#flowerPinkLeft)" />
        <circle cx="18" cy="480" r="4" fill="#FFF" />

        <ellipse cx="34" cy="560" rx="15" ry="7" transform="rotate(-30 34 560)" fill="#366D39" />
        <ellipse cx="16" cy="630" rx="14" ry="7" transform="rotate(35 16 630)" fill="#549A57" />
        <circle cx="25" cy="690" r="10" fill="#FFB74D" />
        <circle cx="25" cy="690" r="4" fill="#BF360C" />
      </svg>

      {/* 右侧垂直藤蔓花架 (Right Border Floral Vines) */}
      <svg
        className="absolute top-0 right-0 w-20 sm:w-28 h-full text-[#2D5A27] drop-shadow-[-2px_0_6px_rgba(18,40,24,0.15)]"
        viewBox="0 0 100 800"
        fill="none"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M82,0 Q65,180 88,340 T70,540 T85,800"
          stroke="url(#vineStemLeft)"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />

        <ellipse cx="72" cy="80" rx="14" ry="7" transform="rotate(-35 72 80)" fill="#4B8B4E" />
        <circle cx="84" cy="130" r="9" fill="#FFB74D" />
        <circle cx="84" cy="130" r="4" fill="#D84315" />

        <ellipse cx="68" cy="210" rx="15" ry="8" transform="rotate(25 68 210)" fill="#366D39" />
        <circle cx="82" cy="280" r="10" fill="url(#flowerPinkLeft)" />
        <circle cx="82" cy="280" r="4" fill="#FFF" />

        <ellipse cx="66" cy="380" rx="16" ry="8" transform="rotate(-20 66 380)" fill="#549A57" />
        <circle cx="75" cy="460" r="10" fill="#FFD54F" />
        <circle cx="75" cy="460" r="4" fill="#E65100" />

        <ellipse cx="72" cy="540" rx="15" ry="7" transform="rotate(30 72 540)" fill="#366D39" />
        <ellipse cx="84" cy="620" rx="14" ry="7" transform="rotate(-35 84 620)" fill="#4B8B4E" />
        <circle cx="76" cy="700" r="9" fill="url(#flowerPinkLeft)" />
        <circle cx="76" cy="700" r="4" fill="#FFF176" />
      </svg>
    </div>
  );
}
