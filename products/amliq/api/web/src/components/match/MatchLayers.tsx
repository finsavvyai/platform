import React from 'react';
import { Section } from './MatchSection';

interface Layer {
  layer: string; score: number; algorithm: string; matched: string;
}

export const LayersSection: React.FC<{
  layers?: Layer[]; explanation?: string;
}> = ({ layers, explanation }) => {
  if (!layers?.length) return null;
  return (
    <Section title="Evidence Layers">
      <div className="space-y-2">
        {layers.map((l, i) => {
          const pct = Math.round(l.score * 100);
          const barColor = pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-green-500';
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-gray-700 dark:text-gray-300">{l.layer}</span>
                <span className="text-gray-500 dark:text-gray-400">{l.algorithm} — {pct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full
                  motion-safe:transition-[width] motion-safe:duration-300`}
                  style={{ width: `${pct}%` }} />
              </div>
              {l.matched && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  Matched: "{l.matched}"
                </p>
              )}
            </div>
          );
        })}
      </div>
      {explanation && (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-3
          border-t border-gray-100 dark:border-gray-700 pt-3">{explanation}</p>
      )}
    </Section>
  );
};
