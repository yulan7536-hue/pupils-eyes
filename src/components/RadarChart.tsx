import { useMemo, useState } from 'react';
import { RADAR_DIMENSIONS, type RadarAnalysis, type RadarDimension } from '../types';
import { RADAR_RUBRICS } from '../utils/aiLesson';

interface RadarChartProps {
  analysis: RadarAnalysis;
}

/**
 * 行智开物 · 教案六维智能雷达图。
 * 六边形蜘蛛网：莫兰迪填充 + 顶点可点击，点中某个维度就在右侧滑出
 * 该维度的【评价量规描述】+【AI 亮点解析】。
 */

const AXIS_COLORS = [
  '#6d8a5c', // 具身感知度 · 鼠尾草绿
  '#b45f59', // 思维建模深度 · 砖红
  '#7b93a8', // 人机协同创造 · 灰蓝
  '#c39a6b', // 跨学科融合度 · 暖砂
  '#a55552', // 地域文化连接 · 深砖红
  '#8a7b5f', // 方案成果可行性 · 土黄褐
];

const GRID_LEVELS = 4; // 同心网格圈数

export default function RadarChart({ analysis }: RadarChartProps) {
  const [active, setActive] = useState<RadarDimension | null>(null);

  const { points, fillPath, cx, cy, R, angle, pt } = useMemo(() => {
    const cx = 150;
    const cy = 150;
    const R = 118;
    const n = RADAR_DIMENSIONS.length;

    const angle = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / n;
    const pt = (i: number, r: number): [number, number] => [
      cx + Math.cos(angle(i)) * r,
      cy + Math.sin(angle(i)) * r,
    ];

    const pts = RADAR_DIMENSIONS.map((dim, i) => {
      const axis = analysis.axes.find((a) => a.dimension === dim);
      const score = axis ? axis.score / 100 : 0;
      return pt(i, R * score);
    });

    const polygon = pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');

    return {
      points: pts.map((p, i) => ({ x: p[0], y: p[1], dim: RADAR_DIMENSIONS[i] })),
      fillPath: polygon,
      cx,
      cy,
      R,
      angle,
      pt,
    };
  }, [analysis]);

  const activeAxis = active
    ? analysis.axes.find((a) => a.dimension === active) ?? null
    : null;

  return (
    <div className="radar">
      <div className="radar__chart">
        <svg viewBox="0 0 300 300" className="radar__svg" role="img" aria-label="教案六维智能雷达图">
          <defs>
            <linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(180,95,89,0.42)" />
              <stop offset="55%" stopColor="rgba(109,138,92,0.4)" />
              <stop offset="100%" stopColor="rgba(123,147,168,0.34)" />
            </linearGradient>
          </defs>

          {/* 同心网格 */}
          {Array.from({ length: GRID_LEVELS }, (_, lvl) => {
            const r = (points.length ? (lvl + 1) / GRID_LEVELS : 0) * R;
            const poly = RADAR_DIMENSIONS.map((_, i) =>
              pt(i, r).map((v) => v.toFixed(1)).join(',')
            ).join(' ');
            return (
              <polygon
                key={lvl}
                points={poly}
                fill="none"
                stroke="rgba(120,104,76,0.22)"
                strokeWidth="1"
              />
            );
          })}

          {/* 轴线 */}
          {RADAR_DIMENSIONS.map((_, i) => {
            const [x, y] = pt(i, R);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="rgba(120,104,76,0.2)"
                strokeWidth="1"
              />
            );
          })}

          {/* 评分填充区 */}
          <polygon points={fillPath} fill="url(#radar-fill)" stroke="rgba(165,85,82,0.85)" strokeWidth="1.6" strokeLinejoin="round" />

          {/* 数据顶点（可点击） */}
          {points.map((p, i) => {
            const isActive = active === p.dim;
            return (
              <g
                key={p.dim}
                className="radar__node"
                role="button"
                tabIndex={0}
                aria-label={`${p.dim}：${analysis.axes[i].score} 分`}
                onClick={() => setActive(p.dim)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActive(p.dim);
                  }
                }}
              >
                <circle cx={p.x} cy={p.y} r={isActive ? 7 : 5} fill={AXIS_COLORS[i]} stroke="#fbf7ea" strokeWidth="2" />
                {isActive && (
                  <circle cx={p.x} cy={p.y} r={12} fill="none" stroke="rgba(165,85,82,0.5)" strokeWidth="1.5" />
                )}
              </g>
            );
          })}

          {/* 维度标签 */}
          {RADAR_DIMENSIONS.map((dim, i) => {
            const a = angle(i);
            // 标签沿顶点方向外推到外圈，六边形上下左右对称布局
            const lx = cx + Math.cos(a) * 143;
            const ly = cy + Math.sin(a) * 143;
            const anchor =
              Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
            const score = analysis.axes[i].score;
            const isActive = active === dim;
            return (
              <g key={dim} className="radar__label" onClick={() => setActive(dim)} role="button" tabIndex={0}>
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="radar__label-text"
                  style={{ fill: isActive ? '#a55552' : 'var(--ink-soft)', fontWeight: isActive ? 600 : 400 }}
                >
                  {dim}
                </text>
                <text
                  x={lx}
                  y={ly + 13}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="radar__label-score tnum"
                  style={{ fill: 'var(--ink-faint)' }}
                >
                  {score}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 右侧量规详情：点中顶点后滑出 */}
      <div className="radar__panel">
        {activeAxis ? (
          <div className="radar__detail" key={activeAxis.dimension}>
            <div className="radar__detail-head">
              <span className="radar__dot" style={{ background: AXIS_COLORS[RADAR_DIMENSIONS.indexOf(activeAxis.dimension)] }} />
              <span className="radar__detail-title">{activeAxis.dimension}</span>
              <span className="radar__detail-score tnum">{activeAxis.score}</span>
            </div>
            <p className="radar__rubric-label">评价量规</p>
            <p className="radar__rubric">{activeAxis.rubric}</p>
            <p className="radar__rubric-label">AI 亮点解析</p>
            <p className="radar__highlight">{activeAxis.highlight}</p>
          </div>
        ) : (
          <div className="radar__empty">
            <p className="radar__empty-tip">点击雷达图上的任意一个维度顶点，查看它的评价量规与本篇教案的 AI 亮点解析。</p>
            <p className="radar__summary">{analysis.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export { AXIS_COLORS };
