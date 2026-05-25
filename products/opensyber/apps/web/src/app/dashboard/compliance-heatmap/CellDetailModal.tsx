'use client';

import { X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ControlDetail, Framework, Category } from './types';

interface Props {
  framework: Framework;
  category: Category;
  controls: ControlDetail[];
  onClose: () => void;
}

const STATUS_CONFIG = {
  pass: { icon: CheckCircle, color: 'text-green-400', label: 'Passing' },
  fail: { icon: XCircle, color: 'text-red-400', label: 'Failing' },
  partial: { icon: AlertTriangle, color: 'text-amber-400', label: 'Partial' },
} as const;

export function CellDetailModal({ framework, category, controls, onClose }: Props) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium">{framework}</h2>
            <p className="text-sm text-neutral-400">{category}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Controls list */}
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {controls.map((ctrl) => {
            const cfg = STATUS_CONFIG[ctrl.status];
            const Icon = cfg.icon;
            return (
              <div key={ctrl.name} className="flex items-center justify-between rounded-lg border border-neutral-800 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ctrl.name}</p>
                    <p className="text-xs text-neutral-500">{cfg.label} &middot; {ctrl.evidenceCount} evidence</p>
                  </div>
                </div>
                <span className="text-xs text-neutral-500 shrink-0 ml-2">
                  {new Date(ctrl.lastAssessed).toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
