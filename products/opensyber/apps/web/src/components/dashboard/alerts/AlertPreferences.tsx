'use client';

import { useState } from 'react';

type Severity = 'critical' | 'critical_high' | 'all';
type PermissionStatus = 'default' | 'granted' | 'denied';

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'critical', label: 'Critical Only' },
  { value: 'critical_high', label: 'Critical + High' },
  { value: 'all', label: 'All Events' },
];

const PERM_COLORS: Record<PermissionStatus, string> = {
  granted: 'text-green-400 bg-green-500/10',
  denied: 'text-red-400 bg-red-500/10',
  default: 'text-amber-400 bg-amber-500/10',
};

function isValidPhone(v: string): boolean {
  return /^\+\d{10,15}$/.test(v.replace(/\s/g, ''));
}

export function AlertPreferences(): React.ReactElement {
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [push, setPush] = useState(false);
  const [pushPerm, setPushPerm] = useState<PermissionStatus>(
    typeof Notification !== 'undefined' ? (Notification.permission as PermissionStatus) : 'default',
  );
  const [severity, setSeverity] = useState<Severity>('critical_high');
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  async function handlePushToggle(checked: boolean) {
    setPush(checked);
    if (checked && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      setPushPerm(perm as PermissionStatus);
    }
  }

  async function handleSave() {
    if (sms && !isValidPhone(phone)) {
      setPhoneError('Enter a valid phone number (e.g. +1 555 000 0000)');
      return;
    }
    setPhoneError('');
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/proxy/user/alert-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, sms, phone: sms ? phone : null, push,
          severity, quietStart, quietEnd,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? `Failed to save (${res.status})`);
      }
      setToast('Preferences saved');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Alert Preferences</h1>
        <p className="text-sm text-neutral-400 mt-1">Choose how and when you receive security alerts</p>
      </div>

      <div className="space-y-6">
        <Card>
          <Toggle label="Email Alerts" checked={email} onChange={setEmail} />
          <Toggle label="SMS Alerts" checked={sms} onChange={setSms} />
          {sms && (
            <div className="pl-12">
              <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
                placeholder="+1 555 000 0000"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2
                  text-sm text-white placeholder-neutral-500 outline-none focus:border-neutral-600 transition" />
              {phoneError && <p className="text-xs text-red-400 mt-1">{phoneError}</p>}
            </div>
          )}
          <Toggle label="Push Notifications" checked={push} onChange={handlePushToggle} />
          {push && (
            <div className="pl-12">
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${PERM_COLORS[pushPerm]}`}>
                {pushPerm}
              </span>
            </div>
          )}
        </Card>

        <Card>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Minimum Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2
              text-sm text-white outline-none focus:border-neutral-600 transition">
            {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Card>

        <Card>
          <p className="text-sm font-medium text-neutral-300 mb-3">
            Quiet Hours <span className="text-neutral-500 font-normal">(no alerts during this period)</span>
          </p>
          <div className="flex items-center gap-3">
            <TimeInput label="Start" value={quietStart} onChange={setQuietStart} />
            <span className="text-neutral-500">to</span>
            <TimeInput label="End" value={quietEnd} onChange={setQuietEnd} />
          </div>
        </Card>

        <button onClick={handleSave} disabled={saving}
          className="bg-info hover:bg-info rounded-lg px-4 py-2 text-sm font-medium
            text-white transition disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {toast && <span className="ml-3 text-sm text-green-400">{toast}</span>}
        {error && <span className="ml-3 text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 space-y-4">{children}</div>;
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}): React.ReactElement {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-neutral-300">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-info' : 'bg-neutral-700'}`}>
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform
          ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}

function TimeInput({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}): React.ReactElement {
  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1">{label}</label>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2
          text-sm text-white outline-none focus:border-neutral-600 transition" />
    </div>
  );
}
