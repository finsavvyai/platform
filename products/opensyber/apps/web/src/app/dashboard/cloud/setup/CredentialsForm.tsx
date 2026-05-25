'use client';

import { useState } from 'react';

type Provider = 'aws' | 'azure' | 'gcp';

interface Props {
  provider: Provider;
  onSubmit: (credentials: Record<string, string>) => void;
}

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'password' | 'textarea';
  mono?: boolean;
}

const FIELDS: Record<Provider, FieldDef[]> = {
  aws: [
    { key: 'roleArn', label: 'Role ARN', placeholder: 'arn:aws:iam::123456789012:role/OpenSyberCSPMRole', type: 'text', mono: true },
  ],
  azure: [
    { key: 'clientId', label: 'Client ID (App ID)', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text', mono: true },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'Enter the client secret', type: 'password' },
    { key: 'tenantId', label: 'Tenant ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text', mono: true },
  ],
  gcp: [
    { key: 'serviceAccountJson', label: 'Service Account JSON Key', placeholder: '{\n  "type": "service_account",\n  "project_id": "...",\n  ...  \n}', type: 'textarea', mono: true },
  ],
};

const PROVIDER_NAMES: Record<Provider, string> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'GCP',
};

export function CredentialsForm({ provider, onSubmit }: Props) {
  const fields = FIELDS[provider];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ''])),
  );
  const [error, setError] = useState<string | null>(null);

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const empty = fields.find((f) => !values[f.key]?.trim());
    if (empty) {
      setError(`${empty.label} is required.`);
      return;
    }
    onSubmit(values);
  }

  const inputClass = 'w-full rounded-md border border-border bg-void px-3 py-2 text-sm';

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h3 className="mb-1 text-lg font-semibold">Enter {PROVIDER_NAMES[provider]} Credentials</h3>
      <p className="mb-6 text-sm text-text-secondary">
        Credentials are validated before being stored, and encrypted at rest.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="mb-1 block text-sm text-text-secondary">{field.label}</label>
            {field.type === 'textarea' ? (
              <textarea
                value={values[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={6}
                className={`${inputClass} ${field.mono ? 'font-mono text-xs' : ''}`}
              />
            ) : (
              <input
                type={field.type}
                value={values[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={`${inputClass} ${field.mono ? 'font-mono text-xs' : ''}`}
              />
            )}
          </div>
        ))}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="rounded-lg bg-signal px-6 py-2.5 text-sm font-medium hover:bg-signal-hover transition"
          >
            Validate Connection
          </button>
        </div>
      </form>
    </div>
  );
}
