'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import type { Role } from '@opensyber/shared';
import { ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_HIERARCHY } from '@opensyber/shared';

interface InviteMemberModalProps {
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: Role;
}

export function InviteMemberModal({ orgId, isOpen, onClose, currentUserRole }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('developer');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const allowedRoles = ASSIGNABLE_ROLES.filter(
    (r) => ROLE_HIERARCHY[r] <= ROLE_HIERARCHY[currentUserRole],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/organizations/${orgId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || 'Failed to send invitation');
      }

      onClose();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded border border-border bg-panel p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invite Team Member</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-text-primary">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white placeholder:text-text-dim focus:border-signal focus:outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-text-primary">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white focus:border-signal focus:outline-none"
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
