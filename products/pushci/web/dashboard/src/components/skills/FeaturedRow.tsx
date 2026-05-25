import { Skill, CAT_COLORS, TIER_BADGE } from './types';

interface Props { skills: Skill[]; onSelect: (s: Skill) => void; }

export default function FeaturedRow({ skills, onSelect }: Props) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
        <span className="text-amber-400">*</span> Most Popular
      </h2>
      <div className="grid gap-4 sm:grid-cols-3 stagger">
        {skills.map(s => (
          <div key={s.id} className="relative rounded-xl overflow-hidden border border-zinc-700/50 card-hover cursor-pointer" onClick={() => onSelect(s)}>
            <div className={`h-16 bg-gradient-to-br ${CAT_COLORS[s.category] || 'from-zinc-600 to-zinc-800'} flex items-end justify-between px-4 pb-2`}>
              <span className="text-white/90 font-semibold text-sm">{s.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TIER_BADGE[s.tier].cls}`}>{TIER_BADGE[s.tier].label}</span>
            </div>
            <div className="p-4 bg-zinc-900">
              <p className="text-xs text-zinc-400 line-clamp-2">{s.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-zinc-500">{s.installs >= 1000 ? `${(s.installs / 1000).toFixed(1)}k` : s.installs} installs</span>
                {s.verified && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
