'use client';

import type { RiskNode, Severity } from './types';

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
};

interface Props {
  chain: RiskNode[];
}

export function ChainVisualization({ chain }: Props) {
  const nodeWidth = 120;
  const nodeHeight = 40;
  const gap = 48;
  const svgWidth = chain.length * (nodeWidth + gap) - gap;
  const svgHeight = 56;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full h-14 mt-3"
      aria-label="Risk chain visualization"
    >
      {chain.map((node, i) => {
        const x = i * (nodeWidth + gap);
        const color = SEVERITY_COLORS[node.severity];

        return (
          <g key={node.id}>
            {/* Arrow to next node */}
            {i < chain.length - 1 && (
              <>
                <line
                  x1={x + nodeWidth}
                  y1={svgHeight / 2}
                  x2={x + nodeWidth + gap - 8}
                  y2={svgHeight / 2}
                  stroke="#525252"
                  strokeWidth={2}
                />
                <polygon
                  points={`${x + nodeWidth + gap - 8},${svgHeight / 2 - 4} ${x + nodeWidth + gap},${svgHeight / 2} ${x + nodeWidth + gap - 8},${svgHeight / 2 + 4}`}
                  fill="#525252"
                />
              </>
            )}

            {/* Node rectangle */}
            <rect
              x={x}
              y={4}
              width={nodeWidth}
              height={nodeHeight}
              rx={8}
              fill={`${color}20`}
              stroke={color}
              strokeWidth={1.5}
            />

            {/* Node label */}
            <text
              x={x + nodeWidth / 2}
              y={svgHeight / 2 + 1}
              textAnchor="middle"
              fill="#d4d4d4"
              fontSize={9}
              fontFamily="system-ui"
            >
              {node.label.length > 18 ? `${node.label.slice(0, 16)}...` : node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
