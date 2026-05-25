'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';
import { Calendar } from 'lucide-react';

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DateRangeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(searchParams.get('from') || defaultFrom());
  const [to, setTo] = useState(searchParams.get('to') || defaultTo());

  const apply = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', from);
    params.set('to', to);
    params.delete('page');
    router.push(`/dashboard/logs?${params.toString()}`);
  }, [from, to, searchParams, router]);

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-wire bg-surface px-4 py-3">
      <Calendar className="h-4 w-4 text-text-secondary flex-shrink-0" />
      <span className="text-xs text-text-secondary font-medium">Date Range:</span>
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs text-text-primary focus:border-signal focus:outline-none"
      />
      <span className="text-xs text-text-secondary">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs text-text-primary focus:border-signal focus:outline-none"
      />
      <button
        onClick={apply}
        className="rounded-lg bg-signal px-3 py-1.5 text-xs font-medium text-white hover:bg-[#00c9ab] transition"
      >
        Apply
      </button>
    </div>
  );
}
