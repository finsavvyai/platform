'use client';

import { useState } from 'react';

interface InstanceActionButtonsProps {
  instanceId: string;
  status: string;
}

export function InstanceActionButtons({ instanceId, status }: InstanceActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(status);

  const handleAction = async (action: 'stop' | 'restart' | 'delete') => {
    setLoading(action);
    try {
      const method = action === 'delete' ? 'DELETE' : 'POST';
      const url = action === 'delete'
        ? `/api/proxy/admin/instances/${instanceId}`
        : `/api/proxy/admin/instances/${instanceId}/${action}`;

      const res = await fetch(url, { method });
      if (res.ok) {
        if (action === 'delete') {
          window.location.reload();
        } else {
          const data = await res.json();
          setCurrentStatus(data.data?.status ?? currentStatus);
        }
      }
    } finally {
      setLoading(null);
    }
  };

  const isRunning = currentStatus === 'running' || currentStatus === 'provisioning';

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 mr-2 capitalize">{currentStatus}</span>
      {isRunning && (
        <button
          onClick={() => handleAction('stop')}
          disabled={loading !== null}
          className="px-2 py-1 rounded text-xs bg-amber-500/15 text-amber-400
                     hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
        >
          {loading === 'stop' ? '...' : 'Stop'}
        </button>
      )}
      <button
        onClick={() => handleAction('restart')}
        disabled={loading !== null}
        className="px-2 py-1 rounded text-xs bg-info/15 text-info
                   hover:bg-info/25 disabled:opacity-50 transition-colors"
      >
        {loading === 'restart' ? '...' : 'Restart'}
      </button>
      <button
        onClick={() => handleAction('delete')}
        disabled={loading !== null}
        className="px-2 py-1 rounded text-xs bg-red-500/15 text-red-400
                   hover:bg-red-500/25 disabled:opacity-50 transition-colors"
      >
        {loading === 'delete' ? '...' : 'Delete'}
      </button>
    </div>
  );
}
