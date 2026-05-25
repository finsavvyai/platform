'use client';

import { useState } from 'react';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'contained', label: 'Contained' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function IncidentStatusSelect({
  incidentId,
  instanceId,
  currentStatus,
}: {
  incidentId: string;
  instanceId: string;
  currentStatus: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleChange(newStatus: string) {
    if (newStatus === currentStatus) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/security/instances/${instanceId}/incidents/${incidentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { message?: string }).message ?? 'Update failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={currentStatus}
      onChange={(e) => handleChange(e.target.value)}
      disabled={loading}
      aria-label="Incident status"
      className="bg-surface border border-wire text-sm rounded-lg px-2 py-1 text-white disabled:opacity-50"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
