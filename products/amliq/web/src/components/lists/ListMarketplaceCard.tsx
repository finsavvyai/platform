import React from 'react';
import { Shield, Globe, Flag, Check, Plus, Clock, RefreshCw, AlertTriangle, Scale } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface MarketplaceList {
  id: string; name: string; description: string; region: string;
  category: string; entity_count: number; update_frequency: string;
  last_synced: string; enabled: boolean; tier: string;
}

interface Props {
  list: MarketplaceList;
  onToggle: () => void;
}

function categoryIcon(cat: string) {
  if (cat === 'pep') return Globe;
  if (cat === 'law_enforcement') return AlertTriangle;
  if (cat === 'regulatory') return Scale;
  if (cat === 'country') return Flag;
  return Shield;
}

const regionColor: Record<string, 'blue' | 'green' | 'orange' | 'purple' | 'gray'> = {
  Global: 'blue', Americas: 'green', Europe: 'purple',
  'Middle East': 'orange', 'Asia-Pacific': 'blue', Africa: 'green',
};

export function ListMarketplaceCard({ list, onToggle }: Props) {
  const Icon = categoryIcon(list.category);
  const synced = list.last_synced
    ? new Date(list.last_synced).toLocaleDateString()
    : 'Not synced';

  return (
    <div className="card-vibrancy flex flex-col justify-between p-lg hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-200">
      <div>
        <div className="flex items-start justify-between mb-md">
          <div className="flex items-center gap-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-apple-md bg-apple-bg-tertiary">
              <Icon className="w-5 h-5" style={{ color: '#C9A96E' }} aria-hidden="true" />
            </div>
            <div>
              <h3 className="sf-headline">{list.name}</h3>
              <Badge size="sm" color={regionColor[list.region] ?? 'gray'}>{list.region}</Badge>
            </div>
          </div>
          {list.enabled && <span className="badge-green animate-pulse">&bull; Active</span>}
        </div>
        <p className="sf-caption line-clamp-2 mb-md">{list.description}</p>
        <div className="grid grid-cols-2 gap-sm mb-md">
          <div className="flex items-center gap-xs sf-caption">
            <Shield className="w-3 h-3" aria-hidden="true" />
            {list.entity_count > 0 ? list.entity_count.toLocaleString() : '—'} entities
          </div>
          <div className="flex items-center gap-xs sf-caption">
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            {list.update_frequency}
          </div>
          <div className="flex items-center gap-xs sf-caption col-span-2">
            <Clock className="w-3 h-3" aria-hidden="true" />
            {synced}
          </div>
        </div>
      </div>
      <button onClick={onToggle}
        aria-label={list.enabled ? `Disable ${list.name}` : `Enable ${list.name}`}
        className={`w-full flex items-center justify-center gap-xs rounded-apple-md py-sm text-[13px] font-semibold transition-all cursor-pointer min-h-[36px] ${
          list.enabled
            ? 'bg-apple-green/15 text-apple-green hover:bg-apple-red/15 hover:text-apple-red'
            : 'text-[#FAFAF8]'
        }`}
        style={!list.enabled ? { background: '#1A1814' } : undefined}>
        {list.enabled ? <><Check className="w-3 h-3" /> Enabled</> : <><Plus className="w-3 h-3" /> Enable</>}
      </button>
    </div>
  );
}
