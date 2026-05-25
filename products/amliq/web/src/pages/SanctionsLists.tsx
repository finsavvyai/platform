import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { RefreshCw, ShoppingBag } from 'lucide-react';
import { useLists } from '../hooks/useLists';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ListCard } from '../components/lists/ListCard';
import { api } from '../api/client';

export function SanctionsLists() {
  const { t } = useTranslation('lists');
  const navigate = useNavigate();
  const { lists, loading, error, refetch, triggerSync } = useLists();
  const [reloading, setReloading] = useState(false);
  const [reloadMsg, setReloadMsg] = useState('');

  const reloadAll = useCallback(async () => {
    setReloading(true);
    setReloadMsg('');
    try {
      await api.post('/admin/lists/refresh', {});
      setReloadMsg('Reload started. Lists will update in the background.');
      setTimeout(() => refetch(), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setReloadMsg(`Error: ${msg}`);
    } finally {
      setReloading(false);
    }
  }, [refetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  const totalEntries = lists.reduce((acc, l) => acc + l.entity_count, 0);

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={`${lists.length} lists • ${totalEntries.toLocaleString()} ${t('entities')}`}
      />
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-sm mb-md">
        <Button variant="secondary" size="sm" onClick={() => navigate('/lists/marketplace')}
          className="flex items-center justify-center gap-xs">
          <ShoppingBag className="w-4 h-4" /> Browse Marketplace
        </Button>
        <Button variant="primary" size="sm" onClick={reloadAll}
          disabled={reloading} className="flex items-center justify-center gap-xs">
          <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
          {reloading ? 'Reloading...' : 'Reload All Lists'}
        </Button>
        {reloadMsg && (
          <span className={`sf-caption ${reloadMsg.startsWith('Error') ? 'text-apple-red' : 'text-apple-green'}`}>
            {reloadMsg}
          </span>
        )}
      </div>
      {error && <p className="text-apple-red sf-caption mb-md" role="alert">{error.message}</p>}
      <div className="space-y-md">
        {lists.map((list) => (
          <ListCard key={list.id} list={list} triggerSync={triggerSync} t={t} />
        ))}
      </div>
    </div>
  );
}
