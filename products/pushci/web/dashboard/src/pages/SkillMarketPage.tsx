import { useState, useEffect, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../hooks/useApi';
import { API_BASE_URL } from '../config';
import { Skill, Project } from '../components/skills/types';
import SkillCard from '../components/skills/SkillCard';
import SkillDetailModal from '../components/skills/SkillDetailModal';
import FeaturedRow from '../components/skills/FeaturedRow';
import FilterBar from '../components/skills/FilterBar';

interface SkillSocialStats { upvotes_count: number; usage_count_all_time: number }

export default function SkillMarketPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, SkillSocialStats>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Skill | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/skills`).then(r => r.json()).then((d: { skills: Skill[] }) => d.skills),
      api.getProjects().catch(() => []),
    ]).then(([s, p]) => {
      setSkills(s); setProjects(p);
      void Promise.all(s.slice(0, 20).map(async (sk) => {
        try {
          const r = await fetch(`${API_BASE_URL}/api/skills/${sk.id}/stats`);
          if (!r.ok) return null;
          return [sk.id, await r.json()] as [string, SkillSocialStats];
        } catch { return null; }
      })).then((pairs) => {
        const map: Record<string, SkillSocialStats> = {};
        for (const pair of pairs) if (pair) map[pair[0]] = pair[1];
        setStats(map);
      });
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => skills.filter(s => {
    if (category !== 'all' && s.category !== category) return false;
    if (tierFilter !== 'all' && s.tier !== tierFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      || s.tags.some(t => t.toLowerCase().includes(q));
  }), [skills, category, tierFilter, search]);

  const featured = useMemo(() => [...skills].sort((a, b) => b.installs - a.installs).slice(0, 3), [skills]);
  const showFeatured = !search && category === 'all' && tierFilter === 'all';

  return (
    <div>
      <PageHeader title="Skill Market" description={`${skills.length} skills — pipelines, checks, deploys, and AI-powered tools.`} />
      {showFeatured && <FeaturedRow skills={featured} onSelect={setSelected} />}
      <FilterBar category={category} setCategory={setCategory} tierFilter={tierFilter}
        setTierFilter={setTierFilter} search={search} setSearch={setSearch} count={filtered.length} />
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-44 rounded-xl shimmer" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger">
          {filtered.map(s => (
            <SkillCard key={s.id} skill={s} onClick={() => setSelected(s)}
              usageCount={stats[s.id]?.usage_count_all_time}
              upvoteCount={stats[s.id]?.upvotes_count} />
          ))}
        </div>
      )}
      {selected && <SkillDetailModal skill={selected} projects={projects} onClose={() => setSelected(null)} />}
    </div>
  );
}
