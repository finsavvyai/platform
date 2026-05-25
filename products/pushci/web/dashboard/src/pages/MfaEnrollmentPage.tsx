import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { API_BASE_URL } from '../config';
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';

type Step = 'loading' | 'idle' | 'enrolling' | 'confirming' | 'enrolled' | 'error';

interface EnrollResponse {
  secret: string;
  qrUrl: string;
  backupCodes: string[];
}

function getToken(): string | null {
  return localStorage.getItem('pushci_token');
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export default function MfaEnrollmentPage() {
  const [step, setStep] = useState<Step>('loading');
  const [enrolled, setEnrolled] = useState(false);
  const [enroll, setEnroll] = useState<EnrollResponse | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ enrolled: boolean }>('/api/mfa/status')
      .then((r) => {
        setEnrolled(r.enrolled);
        setStep('idle');
      })
      .catch(() => setStep('idle'));
  }, []);

  async function startEnroll() {
    try {
      setStep('enrolling');
      const r = await api<EnrollResponse>('/api/mfa/enroll', { method: 'POST' });
      setEnroll(r);
      setStep('confirming');
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  }

  async function confirmCode() {
    try {
      await api('/api/mfa/confirm', { method: 'POST', body: JSON.stringify({ code }) });
      setStep('enrolled');
      setEnrolled(true);
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  }

  async function disableMfa() {
    if (!confirm('Disable MFA? You will lose your second factor immediately.')) return;
    try {
      await api('/api/mfa/disable', { method: 'POST' });
      setEnrolled(false);
      setEnroll(null);
      setStep('idle');
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader title="Multi-factor authentication" description="TOTP — 6-digit codes from any authenticator app." />

      {step === 'loading' && <div className="text-t3 text-sm">Loading…</div>}

      {step === 'idle' && !enrolled && (
        <div className="rounded-xl border border-border-base bg-surface p-6">
          <p className="text-t2 mb-4">MFA is not yet enabled on your account.</p>
          <button className={btnGesturePrimary} onClick={startEnroll}>
            Enroll authenticator
          </button>
        </div>
      )}

      {step === 'idle' && enrolled && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <p className="text-emerald-300 font-semibold mb-3">MFA is active on your account.</p>
          <button className={btnGestureSubtle} onClick={disableMfa}>
            Disable MFA
          </button>
        </div>
      )}

      {step === 'confirming' && enroll && (
        <div className="rounded-xl border border-border-base bg-surface p-6 space-y-4">
          <div>
            <p className="text-t1 font-semibold mb-2">1. Scan this QR code</p>
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(enroll.qrUrl)}`}
              alt="TOTP QR code"
              className="w-48 h-48 border border-border-base rounded-lg bg-white p-2"
            />
            <p className="text-t3 text-xs font-mono mt-2">Secret: {enroll.secret}</p>
          </div>
          <div>
            <p className="text-t1 font-semibold mb-2">2. Save backup codes</p>
            <ul className="grid grid-cols-2 gap-1 text-xs font-mono text-t2 bg-raised p-3 rounded">
              {enroll.backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-t1 font-semibold mb-2">3. Enter a code to confirm</p>
            <input
              type="text"
              className="bg-raised border border-border-base rounded px-3 py-2 font-mono w-40"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <button className={`${btnGesturePrimary} ml-3`} onClick={confirmCode} disabled={code.length !== 6}>
              Confirm
            </button>
          </div>
        </div>
      )}

      {step === 'enrolled' && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <p className="text-emerald-300 font-semibold">MFA enrollment complete.</p>
        </div>
      )}

      {step === 'error' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6">
          <p className="text-rose-300 font-semibold mb-3">{error}</p>
          <button className={btnGestureSubtle} onClick={() => setStep('idle')}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
