/**
 * 成果意象：按课题标题给出一枚手绘黏土图形。
 * 这个世界里没有一张照片——所有图像都是画出来的，因此不存在"伪造学生照片"的问题。
 */

export type MotifKind = 'bamboo' | 'flower' | 'tree' | 'citrus' | 'feather' | 'seed';

export function motifFor(title: string): MotifKind {
  if (/竹|笋/.test(title)) return 'bamboo';
  if (/海菜花|水生|湖|洱/.test(title)) return 'flower';
  if (/槐|树|年轮|胡同/.test(title)) return 'tree';
  if (/柑橘|橘|蜜|蜂/.test(title)) return 'citrus';
  if (/羽|锦鸡|色谱|矿/.test(title)) return 'feather';
  return 'seed';
}

const P = {
  leaf: '#9dae9f',
  leafDeep: '#7d9282',
  leafLit: '#b6c4b3',
  wood: '#b28f6b',
  woodDeep: '#8b6f51',
  rose: '#c39d9a',
  roseDeep: '#a87f7d',
  ochre: '#d3bc8d',
  ochreDeep: '#b9a071',
  cream: '#f1ece0',
  ink: '#4a554c',
  sky: '#e4e4d7',
};

export default function ClayMotif({ kind }: { kind: MotifKind }) {
  switch (kind) {
    case 'bamboo':
      return (
        <svg viewBox="0 0 120 120" fill="none">
          <ellipse cx="60" cy="108" rx="42" ry="6" fill={P.leafDeep} opacity="0.18" />
          {[
            { x: 34, h: 78 },
            { x: 58, h: 92 },
            { x: 82, h: 70 },
          ].map((s, i) => (
            <g key={i}>
              <rect x={s.x} y={108 - s.h} width="9" height={s.h} rx="4.5" fill={i === 1 ? P.leaf : P.leafDeep} />
              {[0, 1, 2].map((k) => (
                <rect
                  key={k}
                  x={s.x}
                  y={108 - s.h + 14 + k * 24}
                  width="9"
                  height="2.6"
                  fill={P.sky}
                  opacity="0.85"
                />
              ))}
            </g>
          ))}
          <path d="M66 40 C 80 30 96 34 100 44 C 86 50 72 50 66 40 Z" fill={P.leafLit} />
          <path d="M66 62 C 52 50 34 52 28 62 C 42 70 58 72 66 62 Z" fill={P.leaf} />
          <path d="M66 84 C 82 76 98 80 102 90 C 88 96 74 94 66 84 Z" fill={P.leaf} />
        </svg>
      );

    case 'flower':
      return (
        <svg viewBox="0 0 120 120" fill="none">
          <rect x="0" y="86" width="120" height="34" fill={P.leafDeep} opacity="0.22" rx="6" />
          <ellipse cx="60" cy="88" rx="46" ry="7" fill={P.leaf} opacity="0.5" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${38 + i * 22} ${0})`}>
              <path d={`M0 86 C 2 70 2 58 0 46`} stroke={P.leafDeep} strokeWidth="3" strokeLinecap="round" />
              {[0, 72, 144, 216, 288].map((deg) => (
                <ellipse
                  key={deg}
                  cx="0"
                  cy={36 - 9}
                  rx="5.4"
                  ry="8.4"
                  fill={P.cream}
                  stroke={P.leaf}
                  strokeWidth="1.4"
                  transform={`rotate(${deg} 0 36)`}
                />
              ))}
              <circle cx="0" cy="36" r="4" fill={P.ochre} />
            </g>
          ))}
          <circle cx="20" cy="98" r="3" fill={P.cream} opacity="0.8" />
          <circle cx="98" cy="104" r="2.4" fill={P.cream} opacity="0.7" />
        </svg>
      );

    case 'tree':
      return (
        <svg viewBox="0 0 120 120" fill="none">
          <ellipse cx="60" cy="110" rx="38" ry="6" fill={P.leafDeep} opacity="0.18" />
          <path d="M54 110 C 56 86 54 72 60 58 C 66 72 64 86 66 110 Z" fill={P.wood} />
          <path d="M60 74 C 46 66 40 58 38 48" stroke={P.wood} strokeWidth="4.4" strokeLinecap="round" />
          <path d="M60 82 C 74 76 82 68 86 58" stroke={P.wood} strokeWidth="4" strokeLinecap="round" />
          <circle cx="38" cy="40" r="20" fill={P.leaf} />
          <circle cx="64" cy="30" r="23" fill={P.leafLit} />
          <circle cx="86" cy="44" r="17" fill={P.leaf} />
          <circle cx="60" cy="50" r="16" fill={P.leafDeep} opacity="0.5" />
          <circle cx="57" cy="24" r="8" fill={P.cream} opacity="0.4" />
        </svg>
      );

    case 'citrus':
      return (
        <svg viewBox="0 0 120 120" fill="none">
          <ellipse cx="60" cy="108" rx="40" ry="6" fill={P.leafDeep} opacity="0.16" />
          <path d="M60 62 C 56 48 62 38 74 32" stroke={P.leafDeep} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M74 32 C 86 22 100 24 104 34 C 92 44 78 44 74 32 Z" fill={P.leaf} />
          <circle cx="44" cy="80" r="22" fill={P.ochre} />
          <circle cx="78" cy="86" r="17" fill={P.ochreDeep} />
          <circle cx="38" cy="74" r="7" fill={P.cream} opacity="0.42" />
          <circle cx="74" cy="82" r="5" fill={P.cream} opacity="0.34" />
          <path d="M44 58 C 38 54 34 52 30 52" stroke={P.woodDeep} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    case 'feather':
      return (
        <svg viewBox="0 0 120 120" fill="none">
          <path d="M84 16 C 52 30 30 62 22 104 C 58 96 82 70 84 16 Z" fill={P.rose} />
          <path d="M84 16 C 62 46 40 74 22 104 C 56 92 78 66 84 16 Z" fill={P.roseDeep} opacity="0.55" />
          <path d="M84 18 C 60 48 40 76 24 102" stroke={P.cream} strokeWidth="2.6" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M${78 - i * 12} ${30 + i * 4} C ${64 - i * 12} ${42 + i * 12} ${54 - i * 10} ${52 + i * 14} ${46 - i * 9} ${64 + i * 12}`}
              stroke={P.ochre}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.85"
            />
          ))}
          <circle cx="34" cy="26" r="4.6" fill={P.ochre} />
          <circle cx="46" cy="20" r="3.4" fill={P.ochreDeep} />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 120 120" fill="none">
          <ellipse cx="60" cy="106" rx="34" ry="6" fill={P.leafDeep} opacity="0.18" />
          <path d="M60 104 C 56 84 58 72 62 62" stroke={P.leafDeep} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M62 62 C 44 50 42 30 58 20 C 74 30 78 50 62 62 Z" fill={P.leaf} />
          <path d="M62 62 C 78 52 96 56 100 68 C 84 76 68 72 62 62 Z" fill={P.leafLit} />
          <circle cx="62" cy="66" r="5" fill={P.ochre} />
        </svg>
      );
  }
}
