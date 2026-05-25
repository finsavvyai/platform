import React, { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { SearchField } from '../components/ui/SearchField';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ListMarketplaceCard } from '../components/lists/ListMarketplaceCard';
import { FilterBar } from '../components/lists/FilterBar';
import { api } from '../api/client';

interface MarketplaceList {
  id: string; name: string; description: string; region: string;
  category: string; source_url: string; entity_count: number;
  update_frequency: string; last_synced: string; enabled: boolean; tier: string;
}

const REGIONS = ['All', 'Global', 'Americas', 'Europe', 'Middle East', 'Asia-Pacific', 'Africa'];
const CATEGORIES = ['All', 'sanctions', 'pep', 'law_enforcement', 'regulatory'];

const categoryLabel: Record<string, string> = {
  All: 'All', sanctions: 'Sanctions', pep: 'PEP',
  law_enforcement: 'Law Enforcement', regulatory: 'Regulatory',
};

export function ListsMarketplace() {
  const [lists, setLists] = useState<MarketplaceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('All');
  const [category, setCategory] = useState('All');

  const fetchLists = useCallback(async () => {
    try {
      const data = await api.get<{ lists: MarketplaceList[] }>('/lists/marketplace');
      setLists(data.lists);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const toggle = async (id: string, enabled: boolean) => {
    const action = enabled ? 'disable' : 'enable';
    await api.post(`/lists/marketplace/${id}/${action}`, {});
    setLists(prev => prev.map(l => l.id === id ? { ...l, enabled: !enabled } : l));
  };

  const filtered = lists.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = (l.name ?? '').toLowerCase().includes(q) || (l.description ?? '').toLowerCase().includes(q);
    const matchRegion = region === 'All' || l.region === region;
    const matchCategory = category === 'All' || l.category === category;
    return matchSearch && matchRegion && matchCategory;
  });

  if (loading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;

  const totalEntities = lists.reduce((sum, l) => sum + l.entity_count, 0);
  const enabledCount = lists.filter(l => l.enabled).length;

  return (
    <div>
      <MarketplaceHero total={lists.length} enabled={enabledCount} entities={totalEntities} />
      <FilterBar items={REGIONS} active={region} onSelect={setRegion} label="Region" />
      <FilterBar items={CATEGORIES} active={category} onSelect={setCategory} label="Category" labelMap={categoryLabel} />
      <div className="mb-lg"><SearchField placeholder="Search lists..." value={search} onChange={setSearch} /></div>
      <p className="sf-caption mb-md">{filtered.length} lists available</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-lg">
        {filtered.map(l => (
          <ListMarketplaceCard key={l.id} list={l} onToggle={() => toggle(l.id, l.enabled)} />
        ))}
      </div>
    </div>
  );
}

function MarketplaceHero({ total, enabled, entities }: { total: number; enabled: number; entities: number }) {
  return (
    <div className="card-vibrancy p-xxl mb-xxl text-center bg-gradient-to-br from-[#C9A96E]/10 to-indigo-600/5">
      <Globe className="w-10 h-10 text-[#C9A96E] mx-auto mb-md" />
      <h1 className="text-3xl font-bold tracking-tight mb-sm sf-title">
        {total} Global Sanctions Lists
      </h1>
      <p className="sf-caption max-w-lg mx-auto">
        {entities.toLocaleString()} entities across sanctions, PEP, law enforcement and regulatory databases. {enabled} currently active.
      </p>
    </div>
  );
}

