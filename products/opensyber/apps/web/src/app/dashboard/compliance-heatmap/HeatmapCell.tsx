'use client';

import type { CellData } from './types';

interface Props {
  cell: CellData;
  onClick: () => void;
}

function cellColor(cell: CellData): string {
  if (!cell.applicable) return 'bg-neutral-800';
  if (cell.score >= 90) return 'bg-green-500/20 hover:bg-green-500/30';
  if (cell.score >= 70) return 'bg-amber-500/20 hover:bg-amber-500/30';
  return 'bg-red-500/20 hover:bg-red-500/30';
}

function textColor(cell: CellData): string {
  if (!cell.applicable) return 'text-neutral-600';
  if (cell.score >= 90) return 'text-green-400';
  if (cell.score >= 70) return 'text-amber-400';
  return 'text-red-400';
}

export function HeatmapCell({ cell, onClick }: Props) {
  if (!cell.applicable) {
    return (
      <td className="p-1">
        <div className="flex items-center justify-center rounded-lg bg-neutral-800 h-12 text-xs text-neutral-600">
          N/A
        </div>
      </td>
    );
  }

  return (
    <td className="p-1">
      <button
        onClick={onClick}
        className={`flex items-center justify-center rounded-lg h-12 w-full transition cursor-pointer ${cellColor(cell)}`}
        aria-label={`${cell.score}% compliant, ${cell.controls.length} controls`}
      >
        <span className={`text-sm font-semibold ${textColor(cell)}`}>
          {cell.score}%
        </span>
      </button>
    </td>
  );
}
