import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AlertActions } from '../components/alerts/AlertActions';
import { AlertDetailSidebar } from '../components/alerts/AlertDetailSidebar';
import { EntityDetailsCard } from '../components/alerts/EntityDetailsCard';
import { AISummaryCard } from '../components/alerts/AISummaryCard';
import { NotesCard } from '../components/alerts/NotesCard';
import { alertsApi } from '../api/alerts';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { Alert } from '../types';

export function AlertDetailPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('alerts');
  const { id } = useParams();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    alertsApi.get(id)
      .then((a) => {
        if (cancelled) return;
        setAlert(a);
        setNotes(a.notes || '');
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : 'Failed to load alert');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="flex justify-center h-96"><LoadingSpinner /></div>;

  if (fetchError || !alert) {
    return (
      <div>
        <Button onClick={() => navigate('/alerts')} className="mb-lg">
          <ArrowLeft className="w-4 h-4 mr-sm" /> Back
        </Button>
        <Card>
          <p className="sf-body text-apple-red mb-sm">{fetchError ?? t('detail.not_found')}</p>
          {fetchError && (
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const name = alert.entity?.name?.fullName || alert.id;

  return (
    <div>
      <div className="mb-lg">
        <Button variant="secondary" onClick={() => navigate('/alerts')}>
          <ArrowLeft className="w-4 h-4 mr-sm" /> Back
        </Button>
      </div>
      <PageHeader title={name} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-xxl">
        <div className="lg:col-span-2 space-y-lg">
          <EntityDetailsCard alert={alert} />
          <AISummaryCard alert={alert} />
          <NotesCard notes={notes} onNotesChange={setNotes} />
          <AlertActions onConfirm={() => {}} onFalsePositive={() => {}}
            onEscalate={() => {}} onDraftAI={() => {}} />
        </div>
        <AlertDetailSidebar alert={alert} />
      </div>
    </div>
  );
}
