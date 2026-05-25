import { CATEGORIES, TIER_BADGE } from './types';

interface Props {
  category: string; setCategory: (c: string) => void;
  tierFilter: string; setTierFilter: (t: string) => void;
  search: string; setSearch: (s: string) => void;
  count: number;
}

export default function FilterBar({ category, setCategory, tierFilter, setTierFilter, search, setSearch, count }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              category === c.id ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-zinc-900 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200'
            }`}>
            <span className="font-mono mr-1 opacity-50">{c.icon}</span>{c.label}
          </button>
        ))}
        <span className="text-zinc-700 mx-1">|</span>
        {['all', 'free', 'pro', 'premium'].map(t => (
          <button key={t} onClick={() => setTierFilter(t)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tierFilter === t ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-zinc-900 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200'
            }`}>
            {t === 'all' ? 'All Tiers' : TIER_BADGE[t]?.label || t}
          </button>
        ))}
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills..."
        className="flex-1 min-w-[180px] rounded-lg border border-zinc-700/50 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none" />
      <span className="text-xs text-zinc-500">{count} skills</span>
    </div>
  );
}
