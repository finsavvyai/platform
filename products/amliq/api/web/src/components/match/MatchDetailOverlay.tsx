import React, { useEffect, useRef } from 'react';
import { MatchDetailPanel } from './MatchDetailPanel';

interface Props {
  match: any;
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-out overlay that shows the full detail panel for a match.
 * Opens from the right side of the screen.
 */
export const MatchDetailOverlay: React.FC<Props> = ({ match, open, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open || !match) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end"
      role="dialog" aria-modal="true" aria-labelledby="match-detail-heading">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm
        motion-safe:animate-fade-in" onClick={onClose} />
      {/* Panel */}
      <div ref={panelRef}
        className="relative w-full max-w-2xl h-full overflow-y-auto
          bg-white dark:bg-gray-900 shadow-2xl motion-safe:animate-slide-in-right">
        <div className="sticky top-0 z-10 flex items-center justify-between
          px-6 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md
          border-b border-gray-100 dark:border-gray-800">
          <h2 id="match-detail-heading"
            className="text-sm font-semibold text-gray-600 dark:text-gray-300">
            Match Details
          </h2>
          <button onClick={onClose} aria-label="Close match details"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400
              dark:hover:text-gray-200 text-xl leading-none px-2 py-1 rounded
              cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800
              transition-colors focus:outline-none focus-visible:ring-2
              focus-visible:ring-blue-500/40">
            ×
          </button>
        </div>
        <div className="p-4">
          <MatchDetailPanel match={match} />
        </div>
      </div>
    </div>
  );
};

export default MatchDetailOverlay;
