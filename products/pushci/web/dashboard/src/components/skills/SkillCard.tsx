import StarRating from '../StarRating';
import SkillUsageCounter from '../SkillUsageCounter';
import { Skill, CAT_COLORS, TIER_BADGE, fmt } from './types';

export default function SkillCard({ skill, onClick, usageCount, upvoteCount }: {
  skill: Skill; onClick: () => void; usageCount?: number; upvoteCount?: number;
}) {
  const tier = TIER_BADGE[skill.tier] || TIER_BADGE.free;
  return (
    <div className="group rounded-xl border border-zinc-700/50 bg-zinc-900 overflow-hidden card-hover cursor-pointer" onClick={onClick}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${CAT_COLORS[skill.category] || 'from-zinc-600 to-zinc-800'} flex items-center justify-center text-white text-xs font-bold`}>
              {skill.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-medium text-zinc-100">{skill.name}</h3>
                {skill.verified && <span className="text-emerald-400 text-xs">*</span>}
              </div>
              <p className="text-[11px] text-zinc-500">{skill.author} &middot; v{skill.version}</p>
            </div>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tier.cls}`}>{tier.label}</span>
        </div>
        <p className="mt-3 text-xs text-zinc-400 line-clamp-2 leading-relaxed">{skill.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skill.tags.slice(0, 3).map(t => (
            <span key={t} className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 font-mono">{t}</span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">{fmt(skill.installs)} installs</span>
            <StarRating rating={3 + (skill.installs % 20) / 10} size="sm" />
            {typeof usageCount === 'number' && <SkillUsageCounter count={usageCount} />}
            {typeof upvoteCount === 'number' && (
              <span className="text-[11px] text-zinc-400" aria-label={`${upvoteCount} upvotes`}>▲ {upvoteCount}</span>
            )}
          </div>
          <span className="rounded-lg px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-all">
            View
          </span>
        </div>
      </div>
    </div>
  );
}
