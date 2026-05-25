'use client';

import { useState } from 'react';
import { Shield, Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { SsoConfig, SsoProvider } from '@opensyber/shared';
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '@opensyber/shared';

interface SsoConfigFormProps {
  orgId: string;
  existingConfig: SsoConfig | null;
}

export function SsoConfigForm({ orgId, existingConfig }: SsoConfigFormProps) {
  const [provider, setProvider] = useState<SsoProvider>(existingConfig?.provider ?? 'saml');
  const [entityId, setEntityId] = useState(existingConfig?.entityId ?? '');
  const [ssoUrl, setSsoUrl] = useState(existingConfig?.ssoUrl ?? '');
  const [certificate, setCertificate] = useState(existingConfig?.certificate ?? '');
  const [oidcClientId, setOidcClientId] = useState(existingConfig?.oidcClientId ?? '');
  const [oidcSecret, setOidcSecret] = useState('');
  const [oidcIssuer, setOidcIssuer] = useState(existingConfig?.oidcIssuer ?? '');
  const [autoProvision, setAutoProvision] = useState(existingConfig?.autoProvision ?? false);
  const [defaultRole, setDefaultRole] = useState(existingConfig?.defaultRole ?? 'viewer');
  const [isActive, setIsActive] = useState(existingConfig?.isActive ?? false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        provider, entityId, ssoUrl, certificate,
        oidcClientId, oidcClientSecret: oidcSecret || undefined,
        oidcIssuer, autoProvision, defaultRole, isActive,
      };
      const res = await fetch(`/api/proxy/organizations/${orgId}/sso`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as { message?: string }).message ?? `Failed (${res.status})`);
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/proxy/organizations/${orgId}/sso/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      setTestResult(res.ok ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded border border-border bg-panel/30 p-6 space-y-6">
      {/* Provider toggle */}
      <div>
        <label id="sso-provider-label" className="block text-sm font-medium mb-2">Provider</label>
        <div className="flex gap-2">
          {(['saml', 'oidc'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                provider === p ? 'bg-signal text-white' : 'bg-surface text-text-secondary hover:bg-neutral-700'
              }`}
            >
              {p === 'saml' ? 'SAML 2.0' : 'OpenID Connect'}
            </button>
          ))}
        </div>
      </div>

      {/* SAML fields */}
      {provider === 'saml' && (
        <>
          <Field label="Entity ID (IdP)" value={entityId} onChange={setEntityId} placeholder="https://idp.example.com/saml" />
          <Field label="SSO URL" value={ssoUrl} onChange={setSsoUrl} placeholder="https://idp.example.com/sso/saml" />
          <div>
            <label htmlFor="sso-certificate" className="block text-sm font-medium mb-2">X.509 Certificate</label>
            <textarea
              id="sso-certificate"
              value={certificate}
              onChange={(e) => setCertificate(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-panel px-4 py-2.5 text-sm font-mono placeholder-neutral-600 focus:border-signal focus:outline-none"
              placeholder="-----BEGIN CERTIFICATE-----"
            />
          </div>
        </>
      )}

      {/* OIDC fields */}
      {provider === 'oidc' && (
        <>
          <Field label="Client ID" value={oidcClientId} onChange={setOidcClientId} placeholder="your-client-id" />
          <Field label="Client Secret" value={oidcSecret} onChange={setOidcSecret} placeholder="Enter new secret (leave blank to keep)" type="password" />
          <Field label="Issuer URL" value={oidcIssuer} onChange={setOidcIssuer} placeholder="https://accounts.google.com" />
        </>
      )}

      {/* Common settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <input id="sso-auto-provision" type="checkbox" checked={autoProvision} onChange={(e) => setAutoProvision(e.target.checked)}
            className="h-4 w-4 rounded border-wire bg-surface" />
          <label htmlFor="sso-auto-provision" className="text-sm">Auto-provision new users</label>
        </div>
        <div>
          <label htmlFor="sso-default-role" className="block text-sm font-medium mb-1">Default Role</label>
          <select id="sso-default-role" value={defaultRole} onChange={(e) => setDefaultRole(e.target.value)}
            className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm focus:border-signal focus:outline-none">
            {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input id="sso-enabled" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-wire bg-surface" />
        <label htmlFor="sso-enabled" className="text-sm font-medium">Enable SSO</label>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          Save Configuration
        </button>
        <button onClick={handleTest} disabled={testing}
          className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-neutral-700 disabled:opacity-50">
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test Connection'}
        </button>
        {testResult === 'success' && <CheckCircle className="h-5 w-5 text-green-400" />}
        {testResult === 'error' && <XCircle className="h-5 w-5 text-red-400" />}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  const fieldId = `sso-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium mb-2">{label}</label>
      <input id={fieldId} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-panel px-4 py-2.5 text-sm placeholder-neutral-600 focus:border-signal focus:outline-none" />
    </div>
  );
}
