import { useState, useEffect } from 'react';
import StarRating from '../StarRating';
import { Skill, Project, CAT_COLORS, TIER_BADGE, fmt } from './types';
import { API_BASE_URL } from '../../config';
import SkillAiSection from './SkillAiSection';
import SkillReviews from './SkillReviews';
import SkillInstallWizard from './SkillInstallWizard';
import SkillComments from '../SkillComments';
import SkillUpvoteButton from '../SkillUpvoteButton';
import SkillUsageCounter from '../SkillUsageCounter';
import { useSkillSocial } from '../../hooks/useSkillSocial';

interface Props { skill: Skill; projects: Project[]; onClose: () => void; }

export default function SkillDetailModal({ skill, projects, onClose }: Props) {
  const [reviews, setReviews] = useState<Array<{ login: string; rating: number; comment: string; created_at: string }>>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [installed, setInstalled] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const tier = TIER_BADGE[skill.tier] || TIER_BADGE.free;
  const social = useSkillSocial(skill.id);
  const currentSub = (() => {
    try { const u = localStorage.getItem('pushci_user'); return u ? (JSON.parse(u) as { sub?: string }).sub ?? null : null; }
    catch { return null; }
  })();
  const isLoggedIn = Boolean(localStorage.getItem('pushci_token'));
  const hasUpvoted = false;

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/skills/${skill.id}/reviews`).then(r => r.json())
      .then((d: { reviews: typeof reviews; avg: number; count: number }) => {
        setReviews(d.reviews || []); setAvgRating(d.avg); setReviewCount(d.count);
      }).catch(() => {});
  }, [skill.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className={`h-20 bg-gradient-to-br ${CAT_COLORS[skill.category] || 'from-zinc-600 to-zinc-800'} flex items-end justify-between px-6 pb-3 rounded-t-2xl relative`}>
          <div>
            <h2 className="text-lg font-bold text-white">{skill.name}</h2>
            <p className="text-xs text-white/70">{skill.author} &middot; v{skill.version}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tier.cls} bg-black/20 backdrop-blur-sm`}>{tier.label}</span>
            {skill.verified && <span className="rounded-full px-2 py-1 text-[10px] text-emerald-300 bg-black/20 backdrop-blur-sm">Verified</span>}
            {installed && <span className="rounded-full px-2 py-1 text-[10px] text-emerald-400 bg-emerald-500/20 backdrop-blur-sm font-medium">Installed</span>}
          </div>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-sm text-zinc-300 leading-relaxed">{skill.description}</p>
          {/* Big Install Button */}
          {!showWizard && (
            <button onClick={() => setShowWizard(true)}
              className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition-all ${installed ? 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-emerald-500 text-black hover:bg-emerald-400'}`}>
              {installed ? 'Reinstall Skill' : 'Install Skill'}
            </button>
          )}
          {showWizard && <SkillInstallWizard skill={skill} projects={projects} onClose={() => setShowWizard(false)} onInstalled={() => setInstalled(true)} />}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>{fmt(skill.installs)} installs</span>
            <StarRating rating={avgRating} size="sm" showValue count={reviewCount} />
            <span>{skill.steps.length} steps</span>
            <span className="capitalize">{skill.category}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {skill.tags.map(t => <span key={t} className="rounded-md bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400 font-mono">{t}</span>)}
          </div>
          {skill.guide && (
            <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-4">
              <h3 className="text-sm font-medium text-zinc-200 mb-2">How It Works</h3>
              <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{skill.guide}</div>
            </div>
          )}
          {skill.prerequisites && skill.prerequisites.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-200 mb-2">Prerequisites</h3>
              <div className="flex flex-wrap gap-1.5">
                {skill.prerequisites.map(p => (
                  <span key={p} className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-0.5">{p}</span>
                ))}
              </div>
            </div>
          )}
          <SkillAiSection skillId={skill.id} />
          <div>
            <h3 className="text-sm font-medium text-zinc-200 mb-2">Pipeline Steps</h3>
            <div className="space-y-1.5">
              {skill.steps.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                  <span className="text-[10px] text-zinc-500 font-mono w-5">{i + 1}</span>
                  <span className="text-xs text-zinc-200 font-medium">{s.name}</span>
                  <code className="text-[11px] text-zinc-400 font-mono truncate flex-1">{s.run}</code>
                  {s.on_fail === 'block' && <span className="text-[9px] text-red-400 bg-red-500/10 rounded px-1.5 py-0.5">blocks</span>}
                </div>
              ))}
            </div>
          </div>
          <SkillReviews skillId={skill.id} avgRating={avgRating} reviewCount={reviewCount} reviews={reviews}
            onRatingUpdate={(avg, count) => { setAvgRating(avg); setReviewCount(count); }} />
          <div className="space-y-3 border-t border-zinc-800 pt-5">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-zinc-200 flex-1">Community</h3>
              <SkillUpvoteButton count={social.stats?.upvotes_count ?? 0} active={hasUpvoted}
                disabled={!isLoggedIn} onToggle={social.toggleUpvote} />
              <SkillUsageCounter count={social.stats?.usage_count_all_time ?? 0} />
            </div>
            <SkillComments comments={social.comments} currentUserSub={currentSub} canPost={isLoggedIn}
              onPost={social.postComment} onDelete={social.deleteComment} />
          </div>
        </div>
      </div>
    </div>
  );
}
