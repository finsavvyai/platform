import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { RefreshCw, Shield } from 'lucide-react';
import type { ListMeta } from '../../api/lists';
import type { TFunction } from 'i18next';

const NAMES: Record<string, string> = {
  'ofac-sdn': 'OFAC SDN', 'ofac': 'OFAC SDN',
  'opensanctions_default': 'OpenSanctions Global',
  'un': 'UN Security Council', 'un-consolidated': 'UN Consolidated',
  'eu_fsf': 'EU Financial Sanctions', 'eu-sanctions': 'EU Sanctions',
  'uk_ofsi': 'UK OFSI', 'gb-fcdo': 'UK FCDO',
  'ch-seco': 'Swiss SECO', 'il-nbctf': 'Israel NBCTF',
  'il-mod-terrorists': 'Israeli MoD Terror List',
  'icij_offshore': 'ICIJ Offshore Leaks',
  'gleif_lei': 'GLEIF LEI Registry',
};

interface ListCardProps {
  list: ListMeta;
  triggerSync: (id: string) => void;
  t: TFunction;
}

export function ListCard({ list, triggerSync, t }: ListCardProps) {
  const name = NAMES[list.id] ??
    list.id.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Card>
      <div className="flex items-start justify-between mb-md">
        <div className="flex items-center gap-md">
          <div className="flex h-9 w-9 items-center justify-center rounded-apple-md bg-[#C9A96E]/10">
            <Shield className="w-4 h-4 text-[#C9A96E]" />
          </div>
          <div>
            <h3 className="sf-headline">{name}</h3>
            <p className="sf-caption text-apple-label-tertiary mt-xs">{list.id}</p>
          </div>
        </div>
        <Badge size="sm" color={list.sync_enabled ? 'green' : 'gray'}>
          {list.sync_enabled ? 'Active' : 'Disabled'}
        </Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <div>
          <p className="sf-caption text-apple-label-tertiary">{t('entities')}</p>
          <p className="sf-body font-semibold">
            {list.entity_count.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="sf-caption text-apple-label-tertiary">{t('threshold')}</p>
          <p className="sf-body font-semibold">
            {(list.threshold * 100).toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="sf-caption text-apple-label-tertiary">{t('last_synced')}</p>
          <p className="sf-body">
            {list.last_synced && list.last_synced > 0
              ? new Date(list.last_synced * 1000).toLocaleDateString()
              : 'Never'}
          </p>
        </div>
        <div className="flex items-end justify-end">
          <Button variant="secondary" size="sm"
            onClick={() => triggerSync(list.id)}
            className="flex items-center gap-xs">
            <RefreshCw className="w-3 h-3" /> Sync
          </Button>
        </div>
      </div>
    </Card>
  );
}
