import { useState } from 'react';

export interface RadarDimension {
  key: string;
  label: string;
  value: number; // 0 - 100
  rubric: string; // 详细量规描述
}

export const DEFAULT_RADAR_DIMENSIONS: RadarDimension[] = [
  {
    key: 'embodied',
    label: '具身感知度',
    value: 92,
    rubric: '学生通过触摸泥土、敲击竹身、嗅闻落叶与花香等真实五感浸润体验的深度与直接性。',
  },
  {
    key: 'modeling',
    label: '思维建模深度',
    value: 86,
    rubric: '在自然观察后，进行泥塑形态提炼、微型生态剧场构建与生命周期逻辑抽象的认知层次。',
  },
  {
    key: 'humanAi',
    label: '人机协同创造',
    value: 78,
    rubric: '利用数字化定格采集、3D星体地理落钉与AI跨学科知识协同探索的融合效度。',
  },
  {
    key: 'interdisciplinary',
    label: '跨学科融合度',
    value: 95,
    rubric: '科学物候观察、美术泥塑手作、生态文学小诗与地理方志调查的多学科有机结合程度。',
  },
  {
    key: 'cultural',
    label: '地域文化连接',
    value: 88,
    rubric: '深度扎根本区县乡村生态特色、非遗手艺与乡土生态故事的血脉连接深度。',
  },
  {
    key: 'feasibility',
    label: '方案成果可行性',
    value: 90,
    rubric: '就地取材（自然落叶、竹壳、原生泥土等零成本耗材）的普适性与常态化课堂落地推广价值。',
  },
];

interface LessonRadarChartProps {
  dimensions?: RadarDimension[];
  tags?: string[];
  size?: number;
}

export default function LessonRadarChart({
  dimensions = DEFAULT_RADAR_DIMENSIONS,
  tags = ['自然+美术', '生物+泥塑', '生态诗歌+乡土地理'],
  size = 280,
}: LessonRadarChartProps) {
  const [activeTooltip, setActiveTooltip] = useState<RadarDimension | null>(null);

  const center = size / 2;
  const radius = size * 0.38;
  const count = dimensions.length;
  const angleStep = (Math.PI * 2) / count;

  // 计算多边形各个顶点坐标
  const getCoordinates = (value: number, index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // 蛛网参考圈
  const webLevels = [0.25, 0.5, 0.75, 1.0];

  // 数据多边形路径点
  const polygonPoints = dimensions
    .map((dim, i) => {
      const { x, y } = getCoordinates(dim.value, i);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="relative flex flex-col items-center select-none py-2">
      {/* 动态提取的跨学科融合标签 (AI Auto-extracted Tags) */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
        <span className="text-[11px] font-bold text-[#3B6647] tracking-wider font-mono">
          AI 跨学科融合标签：
        </span>
        {tags.map((t, idx) => (
          <span
            key={idx}
            className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EAF2E6] text-[#245C33] border border-[#245C33]/15 font-serif"
          >
            🌿 {t}
          </span>
        ))}
      </div>

      {/* SVG 手绘微颤风格六维雷达图 */}
      <div className="relative">
        <svg
          width={size}
          height={size}
          className="overflow-visible"
        >
          <defs>
            {/* 雷达图手绘翡翠渐变填充 */}
            <linearGradient id="radarClayGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#438D53" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#245C33" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* 蛛网同心参考层（手绘微虚线） */}
          {webLevels.map((lvl, lIdx) => {
            const levelPoints = Array.from({ length: count })
              .map((_, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const r = lvl * radius;
                return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
              })
              .join(' ');

            return (
              <polygon
                key={`web-${lIdx}`}
                points={levelPoints}
                fill="none"
                stroke="#1B4224"
                strokeOpacity={0.12}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            );
          })}

          {/* 六条主轴射线 */}
          {dimensions.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            return (
              <line
                key={`axis-${i}`}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="#1B4224"
                strokeOpacity={0.15}
                strokeWidth={1}
              />
            );
          })}

          {/* 数据多边形实体 */}
          <polygon
            points={polygonPoints}
            fill="url(#radarClayGrad)"
            stroke="#245C33"
            strokeWidth={2.2}
            strokeLinejoin="round"
            className="transition-all duration-500"
          />

          {/* 数据顶点与触点 */}
          {dimensions.map((dim, i) => {
            const { x, y } = getCoordinates(dim.value, i);
            const isHovered = activeTooltip?.key === dim.key;

            return (
              <g key={`point-${dim.key}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 6 : 4}
                  fill={isHovered ? '#D6634C' : '#245C33'}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  className="transition-all duration-300 cursor-pointer"
                  onClick={() => setActiveTooltip(isHovered ? null : dim)}
                />
              </g>
            );
          })}

          {/* 
            顶点交互文字标签（可点击弹出详细量规描述）
          */}
          {dimensions.map((dim, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const labelR = radius + 24;
            const lx = center + labelR * Math.cos(angle);
            const ly = center + labelR * Math.sin(angle);
            const isHovered = activeTooltip?.key === dim.key;

            // 根据左右位置微调文本锚点
            let textAnchor: 'middle' | 'start' | 'end' = 'middle';
            if (Math.cos(angle) > 0.3) textAnchor = 'start';
            else if (Math.cos(angle) < -0.3) textAnchor = 'end';

            return (
              <g key={`label-${dim.key}`} className="cursor-pointer">
                <text
                  x={lx}
                  y={ly}
                  textAnchor={textAnchor}
                  dominantBaseline="central"
                  fontSize="10.5"
                  fontWeight="bold"
                  fill={isHovered ? '#D6634C' : '#1A3320'}
                  className="font-serif hover:fill-[#D6634C] transition-colors"
                  onClick={() => setActiveTooltip(isHovered ? null : dim)}
                >
                  {dim.label} ({dim.value}%)
                </text>
              </g>
            );
          })}
        </svg>

        {/* 
          手绘 Tooltip 弹出层：显示该维度的详细量规描述 (Rubric Definition)
        */}
        {activeTooltip && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-64 bg-[#FFFDF2] p-3.5 rounded-xl border-2 border-[#1E3824] shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-1 border-b border-[#1E3824]/15 mb-2">
              <span className="font-bold text-xs text-[#1E3824] flex items-center gap-1">
                <span>🎯</span>
                <span>{activeTooltip.label} 量规标准</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveTooltip(null)}
                className="text-xs text-stone-500 hover:text-stone-900 cursor-pointer font-bold px-1"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-[#2C4A32] font-serif">
              {activeTooltip.rubric}
            </p>
            <div className="mt-2 pt-1 flex items-center justify-between text-[10px] text-[#3B6647] font-mono font-bold">
              <span>当前相对占比评定：</span>
              <span className="text-[#D6634C] text-xs font-black">{activeTooltip.value}%</span>
            </div>
          </div>
        )}
      </div>

      <span className="text-[10px] text-[#3B6647]/70 font-sans mt-2">
        💡 点击任意维度文字，即可查看该评价指标的手绘量规详细定义
      </span>
    </div>
  );
}
