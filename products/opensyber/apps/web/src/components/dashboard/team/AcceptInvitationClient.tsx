'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { writeActiveOrgId } from '@/lib/org-context';

interface AcceptInvitationClientProps {
  token: string;
}

export function AcceptInvitationClient({ token }: AcceptInvitationClientProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'expired' | 'already' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  useEffect(() => {
    async function accept() {
      try {
        const res = await fetch(`/api/proxy/invitations/${token}/accept`, { method: 'POST' });
        const data = await res.json() as { message?: string; orgId?: string };

        if (res.ok) {
          if (data.orgId) writeActiveOrgId(userId, data.orgId);
          setStatus('success');
          setTimeout(() => { window.location.href = '/dashboard/team'; }, 1500);
        } else if (res.status === 410) {
          setStatus('expired');
        } else if (res.status === 409) {
          setStatus('already');
        } else {
          setStatus('error');
          setMessage(data.message || 'Failed to accept invitation');
        }
      } catch {
        setStatus('error');
        setMessage('Network error');
      }
    }
    accept();
  }, [token, userId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-void">
      <div className="max-w-sm text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-signal" />
            <p className="text-text-secondary">Accepting invitation...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="mx-auto h-10 w-10 text-green-400" />
            <p className="text-white font-medium">Welcome to the team!</p>
            <p className="text-sm text-text-secondary">Redirecting to your dashboard...</p>
          </>
        )}
        {status === 'expired' && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-amber-400" />
            <p className="text-white font-medium">Invitation Expired</p>
            <p className="text-sm text-text-secondary">Ask your team admin to send a new invite.</p>
          </>
        )}
        {status === 'already' && (
          <>
            <CheckCircle className="mx-auto h-10 w-10 text-signal" />
            <p className="text-white font-medium">Already a Member</p>
            <a href="/dashboard/team" className="text-sm text-signal hover:text-signal-hover">
              Go to Team Dashboard &rarr;
            </a>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-red-400" />
            <p className="text-white font-medium">Something went wrong</p>
            <p className="text-sm text-text-secondary">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
