'use client';

interface SessionFiltersProps {
  sessionType: string;
  onSessionTypeChange: (value: string) => void;
  riskLevel: string;
  onRiskLevelChange: (value: string) => void;
  flaggedOnly: boolean;
  onFlaggedOnlyChange: (value: boolean) => void;
  userFilter: string;
  onUserFilterChange: (value: string) => void;
}

const selectClass =
  'rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-signal';

export function SessionFilters(props: SessionFiltersProps): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <input
        type="text"
        placeholder="Filter by user..."
        value={props.userFilter}
        onChange={(e) => props.onUserFilterChange(e.target.value)}
        className={`${selectClass} w-48`}
        aria-label="Filter by user"
      />
      <select
        value={props.sessionType}
        onChange={(e) => props.onSessionTypeChange(e.target.value)}
        className={selectClass}
        aria-label="Session type"
      >
        <option value="all">All Types</option>
        <option value="SSH">SSH</option>
        <option value="Web">Web</option>
        <option value="API">API</option>
      </select>
      <select
        value={props.riskLevel}
        onChange={(e) => props.onRiskLevelChange(e.target.value)}
        className={selectClass}
        aria-label="Risk level"
      >
        <option value="all">All Risk Levels</option>
        <option value="high">High (&gt;70)</option>
        <option value="medium">Medium (40-70)</option>
        <option value="low">Low (&lt;40)</option>
      </select>
      <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
        <input
          type="checkbox"
          checked={props.flaggedOnly}
          onChange={(e) => props.onFlaggedOnlyChange(e.target.checked)}
          className="rounded border-neutral-600 bg-neutral-800 text-info focus:ring-signal"
        />
        Flagged only
      </label>
    </div>
  );
}
