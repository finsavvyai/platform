'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

export function AddIncidentComment({
  incidentId,
  instanceId,
}: {
  incidentId: string;
  instanceId: string;
}) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/security/instances/${instanceId}/incidents/${incidentId}/events`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'comment', content }),
        },
      );
      if (res.ok) {
        setContent('');
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { message?: string }).message ?? 'Failed to add comment');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h3 className="text-sm font-semibold mb-3 text-text-primary">Add Comment</h3>
      <div className="flex gap-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment or evidence..."
          rows={2}
          className="flex-1 bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !content.trim()}
          className="self-end rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
