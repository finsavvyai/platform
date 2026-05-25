'use client';

import { useState } from 'react';
import {
  createWorkforceApp,
  type CreateWorkforceAppInput,
} from '@/lib/tokenforge-api-workforce';

const IDP_OPTIONS = [
  { value: 'oidc_okta', label: 'Okta' },
  { value: 'oidc_entra', label: 'Microsoft Entra' },
  { value: 'oidc_google', label: 'Google Workspace' },
  { value: 'oidc_auth0', label: 'Auth0' },
  { value: 'oidc_generic', label: 'Generic OIDC' },
] as const;

const FIELDS: Array<{ key: keyof CreateWorkforceAppInput; label: string; placeholder: string }> = [
  { key: 'name', label: 'App Name', placeholder: 'e.g. Corp Okta' },
  { key: 'issuer', label: 'Issuer URL', placeholder: 'https://acme.okta.com/oauth2/default' },
  { key: 'audience', label: 'Client ID (aud)', placeholder: '0oaXXXXXXXXX' },
  { key: 'jwksUri', label: 'JWKS URI', placeholder: 'https://acme.okta.com/oauth2/default/v1/keys' },
];

export function CreateWorkforceAppForm({
  apiKey,
  onDone,
  onCancel,
}: {
  apiKey: string;
  onDone: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const [form, setForm] = useState<CreateWorkforceAppInput>({
    name: '',
    idpType: 'oidc_okta',
    issuer: '',
    audience: '',
    jwksUri: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(field: keyof CreateWorkforceAppInput, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createWorkforceApp(apiKey, form);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 rounded-xl border border-border/50 bg-panel p-5">
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-text-secondary">IdP Type</label>
        <select
          value={form.idpType}
          onChange={(e) => set('idpType', e.target.value)}
          className="w-full rounded-lg border border-border/50 bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-info"
        >
          {IDP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {FIELDS.map((f) => (
        <div key={f.key} className="mb-4">
          <label className="mb-1 block text-xs font-medium text-text-secondary">{f.label}</label>
          <input
            value={(form[f.key] as string) ?? ''}
            onChange={(e) => set(f.key, e.target.value)}
            required
            placeholder={f.placeholder}
            className="w-full rounded-lg border border-border/50 bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-info"
          />
        </div>
      ))}
      {error && <p className="mb-3 text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !form.name || !form.issuer}
          className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:bg-info/90 transition disabled:opacity-50"
        >
          {saving ? 'Connecting...' : 'Connect IdP'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg bg-surface px-4 py-2 text-sm hover:bg-surface/80 transition">
          Cancel
        </button>
      </div>
    </form>
  );
}
