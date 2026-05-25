import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Plus, Check, Clock } from 'lucide-react';
import type { ListConfigItem } from '../../api/config';

interface Props { lists: ListConfigItem[]; t: (k: string) => string }

export function ListsPanel({ lists, t }: Props) {
  return (
    <div className="glass-panel rounded-apple-lg p-xl">
      <div className="flex items-center justify-between mb-md">
        <h3 className="sf-headline sf-title">{t('lists.title')} ({lists.length})</h3>
        <Link to="/lists/marketplace"
          className="flex items-center gap-xs text-[13px] font-semibold hover:underline" style={{ color: '#C9A96E' }}>
          <Plus className="w-4 h-4" /> Add Lists
        </Link>
      </div>
      {lists.length === 0 ? <EmptyLists /> : lists.map((l) => <ListRow key={l.list_id} list={l} />)}
    </div>
  );
}

function EmptyLists() {
  return (
    <div className="text-center py-xl">
      <Shield className="w-8 h-8 mx-auto mb-sm" style={{ color: 'var(--dash-text-tertiary)' }} />
      <p className="sf-body mb-sm" style={{ color: 'var(--dash-text-secondary)' }}>No lists enabled yet</p>
      <Link to="/lists/marketplace" className="text-[13px] font-semibold hover:underline" style={{ color: '#C9A96E' }}>
        Browse Marketplace
      </Link>
    </div>
  );
}

function ListRow({ list }: { list: ListConfigItem }) {
  const label = list.list_id?.trim()
    || list.parser_type?.trim()
    || extractHost(list.custom_source_url || list.source_url)
    || 'Untitled list';
  return (
    <div className="flex items-center justify-between py-sm border-b last:border-0" style={{ borderColor: 'var(--dash-border)' }}>
      <div className="flex items-center gap-sm min-w-0">
        <Shield className="w-4 h-4 shrink-0" style={{ color: '#C9A96E' }} />
        <span className="sf-body truncate" title={list.source_url || list.custom_source_url}>{label}</span>
      </div>
      <div className="flex items-center gap-md shrink-0">
        {list.sync_enabled && <Check className="w-3 h-3 text-apple-green" />}
        <span className="sf-caption flex items-center gap-xs">
          <Clock className="w-3 h-3" /> {list.sync_schedule || 'Manual'}
        </span>
      </div>
    </div>
  );
}

function extractHost(url?: string): string {
  if (!url) return '';
  try { return new URL(url).hostname; } catch { return url; }
}
