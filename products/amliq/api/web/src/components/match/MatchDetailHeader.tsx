import React from 'react';
import { TypeBadge, ListBadge } from './MatchBadges';
import { TimestampRow } from './MatchBio';
import type { MatchData } from './MatchDetailPanel';

interface Props {
  match: MatchData;
  onClose?: () => void;
}

const dispositionClass = (d?: string) =>
  d === 'AutoEscalate'
    ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';

const scoreClass = (score: number) =>
  score >= 80 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  : score >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';

export const MatchDetailHeader: React.FC<Props> = ({ match, onClose }) => {
  const score = Math.round(match.confidence * 100);
  return (
    <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800
      dark:to-gray-900 px-6 py-5 border-b border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {match.entity_name}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <TypeBadge type={match.type} />
            <ListBadge listId={match.list_id} />
            {match.dataset && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {match.dataset}
              </span>
            )}
            {match.disposition && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium
                ${dispositionClass(match.disposition)}`}>
                {match.disposition}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${scoreClass(score)}`}>
            {score}%
          </span>
          {onClose && (
            <button onClick={onClose} aria-label="Close match details"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400
                dark:hover:text-gray-200 text-xl leading-none cursor-pointer rounded
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">×</button>
          )}
        </div>
      </div>
      <TimestampRow
        firstSeen={match.firstSeen} lastSeen={match.lastSeen}
        lastChange={match.lastChange} listingDate={match.listingDate}
      />
    </div>
  );
};
