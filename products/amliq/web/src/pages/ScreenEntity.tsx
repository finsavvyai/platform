import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ScreeningForm } from '../components/screening/ScreeningForm';
import { ScreeningLayersList, LAYER_LISTS, LayerKey } from '../components/screening/ScreeningLayersList';
import { ScreenResults } from '../components/screening/ScreenResults';
import { ScreeningQuotaBanner } from '../components/screening/ScreeningQuotaBanner';
import { LimitReachedBanner } from '../components/screening/LimitReachedBanner';
import { ScreeningProgress } from '../components/screening/ScreeningProgress';
import { ExportButton } from '../components/ui/ExportButton';
import { useScreening } from '../hooks/useScreening';
import { ApiError } from '../api/client';
import type { EntityType } from '../types';

interface FormData {
  firstName: string; lastName: string; companyName: string; dob: string; nationality: string; threshold: number;
}

export function ScreenEntity() {
  const { t } = useTranslation('screening');
  const navigate = useNavigate();
  const { result, loading, error, screen, clear } = useScreening();
  const [lastQuery, setLastQuery] = useState('');
  const [quotaRefreshKey, setQuotaRefreshKey] = useState(0);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    ofac: true, eu: true, un: true, custom: true,
  });
  const isLimitError = error instanceof ApiError && error.status === 402;

  useEffect(() => {
    if (result || error) {
      setQuotaRefreshKey(k => k + 1);
      try { performance.measure('screening:total', 'screening:start'); } catch { /* mark absent on first render */ }
    }
  }, [result, error]);

  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return;
    const THRESHOLD = 3000;
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name !== 'screening:total') continue;
        const value = entry.duration;
        const exceeded = value > THRESHOLD;
        if (import.meta.env.DEV) {
          if (exceeded) console.warn(`[perf] screening:total ${Math.round(value)}ms exceeds ${THRESHOLD}ms budget`);
        } else if (Math.random() < 0.1) {
          // 10% sampling — sendBeacon survives page unload, no keepalive needed
          navigator.sendBeacon(
            `${API_BASE}/api/v1/analytics/perf-budget`,
            new Blob(
              [JSON.stringify({ metric: 'screening:total', value, exceeded, threshold: THRESHOLD, url: new URL(location.href).pathname })],
              { type: 'application/json' },
            ),
          );
        }
      }
    });
    observer.observe({ type: 'measure', buffered: true });
    return () => observer.disconnect();
  }, []);

  const selectedLists = (Object.keys(layers) as LayerKey[])
    .filter(k => layers[k])
    .flatMap(k => LAYER_LISTS[k]);

  const handleSubmit = async (data: FormData, type: EntityType) => {
    const name = type === 'individual' ? `${data.firstName} ${data.lastName}`.trim() : data.companyName;
    setLastQuery(name);
    if (selectedLists.length === 0) return;
    performance.mark('screening:start');
    try {
      await screen({
        entity_name: name, entity_type: type,
        dob: data.dob || undefined, nationality: data.nationality || undefined,
        threshold: data.threshold / 100,
        lists: selectedLists,
      });
    } catch { /* error captured in useScreening state */ }
  };

  // Client-side filter: only keep matches whose source/dataset is in an
  // enabled layer. Uses source/dataset/list fields so it works regardless
  // of which identifier the backend returns.
  const filteredResult = (() => {
    if (!result) return result;
    const matches = (result.matches ?? []).filter(m => {
      const stamp = `${m.dataset ?? ''} ${m.source_type ?? ''} ${(m as { lists?: string[] }).lists?.join(' ') ?? ''} ${m.source_url ?? ''}`.toLowerCase();
      if (layers.ofac && stamp.includes('ofac')) return true;
      if (layers.eu && (stamp.includes('eu_') || stamp.includes(' eu ') || stamp.includes('europa'))) return true;
      if (layers.un && stamp.includes(' un') ) return true;
      if (layers.custom && (stamp.includes('pep') || stamp.includes('adverse') || stamp.includes('custom'))) return true;
      // Fall through — if no layer stamp matches but custom is enabled, keep it
      // (treat unknown as custom so we don't hide real matches).
      return layers.custom;
    });
    return { ...result, matches };
  })();

  return (
    <div>
      <div className="text-center mb-xxl">
        <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#C9A96E]/10 mb-lg">
          <div className="absolute inset-0 rounded-full bg-[#C9A96E]/20 blur-xl" />
          <img src="/logo.svg" alt="AMLIQ" className="relative w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sf-title mb-sm">{t('title')}</h1>
        <p className="sf-caption max-w-md mx-auto">{t('description')}</p>
      </div>

      <div className="max-w-4xl mx-auto mb-lg">
        <ScreeningQuotaBanner refreshKey={quotaRefreshKey} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg max-w-4xl mx-auto">
        <div className="lg:col-span-2 glass-panel rounded-apple-lg p-lg">
          <ScreeningForm onSubmit={handleSubmit} loading={loading} />
        </div>
        <ScreeningLayersList value={layers} onChange={setLayers} />
      </div>

      {error && isLimitError && <LimitReachedBanner error={error} />}
      {error && !isLimitError && (
        <p className="text-apple-red sf-caption mt-md text-center" role="alert">{error.message}</p>
      )}

      {loading && (
        <div className="mt-xxl">
          <ScreeningProgress query={lastQuery} />
        </div>
      )}

      {selectedLists.length === 0 && !loading && (
        <p className="text-apple-red sf-caption mt-md text-center" role="alert">
          Enable at least one screening layer to run a check.
        </p>
      )}

      {filteredResult && !isLimitError && (
        <div className="max-w-4xl mx-auto mt-xl">
          <div className="flex items-center justify-between mb-lg">
            <div>
              <h2 className="sf-title">Screening Results</h2>
              <p className="sf-caption mt-xs" style={{ color: 'var(--dash-text-secondary)' }}>
                Showing {filteredResult.matches?.length ?? 0} of {result?.matches?.length ?? 0} matches — filtered by active layers
              </p>
            </div>
            <ExportButton
              filename={`screening-results-${new Date().toISOString().split('T')[0]}.csv`}
              url={`/api/v1/export/screenings?entity_name=${encodeURIComponent(lastQuery)}&format=csv`}
            />
          </div>
          <ScreenResults data={filteredResult} />
        </div>
      )}
    </div>
  );
}
