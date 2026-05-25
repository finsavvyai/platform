'use client';

import type { NodeType } from './graph-types';
import { NODE_COLORS } from './graph-types';

interface Props {
  type: NodeType;
  x: number;
  y: number;
  r: number;
  highlighted: boolean;
  dimmed: boolean;
  pulsing: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  label: string;
}

export function NodeShape({
  type, x, y, r, highlighted, dimmed, pulsing,
  onClick, onMouseEnter, onMouseLeave, label,
}: Props) {
  const color = NODE_COLORS[type];
  const opacity = dimmed ? 0.2 : 1;
  const strokeWidth = highlighted ? 3 : 1.5;
  const strokeColor = highlighted ? '#fff' : color;

  return (
    <g
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer', opacity }}
      data-testid={`graph-node-${type}`}
    >
      {pulsing && (
        <circle cx={x} cy={y} r={r + 6} fill="none" stroke="#ef4444" strokeWidth={2}>
          <animate attributeName="r" from={String(r + 4)} to={String(r + 14)} dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.8" to="0" dur="1.2s" repeatCount="indefinite" />
        </circle>
      )}
      <ShapePath type={type} x={x} y={y} r={r} fill={`${color}30`} stroke={strokeColor} strokeWidth={strokeWidth} />
      <text x={x} y={y + r + 14} textAnchor="middle" fill="#a3a3a3" fontSize={10}>
        {label.length > 16 ? `${label.slice(0, 14)}...` : label}
      </text>
      <TypeIcon type={type} x={x} y={y} />
    </g>
  );
}

function ShapePath({
  type, x, y, r, fill, stroke, strokeWidth,
}: { type: NodeType; x: number; y: number; r: number; fill: string; stroke: string; strokeWidth: number }) {
  switch (type) {
    case 'cloud_account':
      return <polygon points={hexPoints(x, y, r)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    case 'iam_role':
      return <polygon points={diamondPoints(x, y, r)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    case 'storage_bucket':
      return <rect x={x - r * 0.8} y={y - r * 0.8} width={r * 1.6} height={r * 1.6} rx={4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    case 'database':
      return <polygon points={octagonPoints(x, y, r)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    case 'secret':
      return <polygon points={keyShape(x, y, r)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    default:
      return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  }
}

function TypeIcon({ type, x, y }: { type: NodeType; x: number; y: number }) {
  const iconMap: Record<NodeType, string> = {
    agent_session: 'A', cloud_account: 'C', iam_role: 'R',
    storage_bucket: 'S', compute_instance: 'VM', database: 'DB',
    secret: 'K', network: 'N',
  };
  return (
    <text x={x} y={y + 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="bold">
      {iconMap[type]}
    </text>
  );
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
}

function diamondPoints(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
}

function octagonPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 8 }, (_, i) => {
    const angle = (Math.PI / 4) * i - Math.PI / 8;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
}

function keyShape(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r * 0.7},${cy - r * 0.4} ${cx + r * 0.7},${cy + r * 0.4} ${cx},${cy + r} ${cx - r * 0.7},${cy + r * 0.4} ${cx - r * 0.7},${cy - r * 0.4}`;
}
