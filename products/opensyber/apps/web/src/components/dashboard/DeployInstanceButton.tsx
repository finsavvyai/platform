'use client';

import { useRef, useState, useEffect } from 'react';
import { Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DeployInstanceForm, type DeployPhase } from './DeployInstanceForm';

const POLL_INTERVAL = 3000;
const MAX_POLLS = 30;

export function DeployInstanceButton() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [phase, setPhase] = useState<DeployPhase>('idle');
  const [region, setRegion] = useState('eu-central');
  const [name, setName] = useState('My Agent');
  const [error, setError] = useState<string | null>(null);
  const [_instanceId, setInstanceId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const pollCount = useRef(0);
  const cancelledRef = useRef(false);

  function openForm() {
    setShowForm(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const pollStatusRef = useRef<((id: string) => Promise<void>) | null>(null);

  useEffect(() => {
    pollStatusRef.current = async (id: string) => {
      if (cancelledRef.current) return;
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        setError('Provisioning is taking longer than expected. Refresh the page to check status.');
        setPhase('error');
        return;
      }
      try {
        const res = await fetch(`/api/proxy/instances/${id}`);
        if (!res.ok) return;
        const data = await res.json() as { instance?: { status: string } };
        const status = data.instance?.status;
        if (status === 'running') {
          setPhase('running');
          return;
        }
        if (status === 'error') {
          setError('Provisioning failed. Please try again or contact support.');
          setPhase('error');
          return;
        }
      } catch {
        // Continue polling on network errors
      }
      if (!cancelledRef.current) {
        setTimeout(() => pollStatusRef.current?.(id), POLL_INTERVAL);
      }
    };
  }, []);

  async function handleDeploy() {
    if (!name.trim()) { setError('Instance name is required.'); return; }

    setPhase('creating');
    setError(null);
    pollCount.current = 0;
    cancelledRef.current = false;
    try {
      const res = await fetch('/api/proxy/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), region }),
      });
      const data = await res.json().catch(() => ({})) as {
        instance?: { id: string; status?: string }; message?: string;
      };
      if (!res.ok && !data.instance?.id) {
        setError(data.message ?? 'Provisioning failed. Please try again.');
        setPhase('error');
        return;
      }
      const id = data.instance!.id;
      setInstanceId(id);
      if (data.instance?.status === 'running') {
        setPhase('running');
      } else {
        setPhase('provisioning');
        setTimeout(() => pollStatusRef.current?.(id), POLL_INTERVAL);
      }
    } catch {
      setError('Network error. Check your connection and try again.');
      setPhase('error');
    }
  }

  const deploying = phase === 'creating' || phase === 'provisioning';

  if (!showForm) {
    return (
      <button
        onClick={openForm}
        className="inline-flex items-center gap-2 rounded-lg bg-signal px-6 py-3 text-sm font-medium hover:bg-signal-hover transition"
      >
        <Rocket className="h-4 w-4" />
        Deploy Instance
      </button>
    );
  }

  return (
    <DeployInstanceForm
      formRef={formRef}
      phase={phase}
      // eslint-disable-next-line react-hooks/refs
      pollCount={pollCount.current}
      name={name}
      region={region}
      error={error}
      deploying={deploying}
      setName={setName}
      setRegion={setRegion}
      onDeploy={handleDeploy}
      onCancel={() => {
        if (deploying) {
          cancelledRef.current = true;
          setPhase('idle');
          setError(null);
        } else {
          setShowForm(false);
        }
      }}
      onViewInstance={() => router.refresh()}
    />
  );
}
