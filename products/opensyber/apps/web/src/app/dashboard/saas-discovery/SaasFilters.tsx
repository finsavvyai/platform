'use client';

import { Search, Filter } from 'lucide-react';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  riskFilter: string;
  onRiskChange: (v: string) => void;
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  shadowOnly: boolean;
  onShadowToggle: (v: boolean) => void;
}

const RISKS = ['All', 'Critical', 'High', 'Medium', 'Low', 'Safe'];
const CATEGORIES = [
  'All',
  'Productivity',
  'AI',
  'DevTools',
  'Communication',
  'Storage',
];

export function SaasFilters({
  search,
  onSearchChange,
  riskFilter,
  onRiskChange,
  categoryFilter,
  onCategoryChange,
  shadowOnly,
  onShadowToggle,
}: Props): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
        <input
          type="text"
          placeholder="Search apps..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 pl-10 pr-4 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-neutral-500" />
        <select
          value={riskFilter}
          onChange={(e) => onRiskChange(e.target.value)}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
        >
          {RISKS.map((r) => (
            <option key={r} value={r}>
              {r === 'All' ? 'All Risks' : r}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === 'All' ? 'All Categories' : c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
          <input
            type="checkbox"
            checked={shadowOnly}
            onChange={(e) => onShadowToggle(e.target.checked)}
            className="rounded border-neutral-700"
          />
          Shadow AI only
        </label>
      </div>
    </div>
  );
}
