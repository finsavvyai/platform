import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import { btnGestureSubtle } from '../styles/gestures';
import SamlTab from '../components/sso/SamlTab';
import ScimTab from '../components/sso/ScimTab';
import { inputCls, labelCls } from '../components/sso/styles';

type TabKey = 'saml' | 'scim';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'saml', label: 'SAML 2.0' },
  { key: 'scim', label: 'SCIM 2.0' },
];

export default function SsoSetupPage() {
  const [tab, setTab] = useState<TabKey>('saml');
  const [tenant, setTenant] = useState('default');

  return (
    <div>
      <PageHeader
        title="Enterprise SSO"
        description="Configure SAML 2.0 and SCIM 2.0 provisioning for your organization."
      />

      <div className="mb-6">
        <label htmlFor="sso-tenant" className={labelCls}>Tenant slug</label>
        <input
          id="sso-tenant"
          value={tenant}
          onChange={(e) => setTenant(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())}
          className={`${inputCls} max-w-md`}
          placeholder="acme"
          maxLength={48}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-zinc-500 mt-1">
          Used in the SAML + SCIM endpoint URLs. One tenant per org.
        </p>
      </div>

      <div role="tablist" aria-label="SSO configuration tabs" className="flex gap-2 mb-6 border-b border-surface-border">
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${btnGestureSubtle} ${
                active
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'saml' ? <SamlTab tenant={tenant} /> : <ScimTab tenant={tenant} />}
    </div>
  );
}
