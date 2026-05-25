import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { btnGesturePrimary, btnGestureSubtle } from '../../styles/gestures';
import { ssoApi, type SamlConfigResponse } from '../../lib/api/sso';
import { inputCls, labelCls } from './styles';

export default function SamlTab({ tenant }: { tenant: string }) {
  const [ssoUrl, setSsoUrl] = useState('');
  const [entityId, setEntityId] = useState('');
  const [cert, setCert] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [existing, setExisting] = useState<SamlConfigResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    ssoApi
      .getSamlConfig(tenant)
      .then((r) => {
        if (cancelled) return;
        setExisting(r);
        if (r.config) {
          setSsoUrl(r.config.ssoUrl);
          setEntityId(r.config.entityId);
        }
      })
      .catch(() => {
        /* not configured yet */
      });
    return () => { cancelled = true; };
  }, [tenant]);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      await ssoApi.saveSamlConfig(tenant, { ssoUrl, entityId, cert });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  }

  const metadataUrl = `${API_BASE_URL}/api/saml/${tenant}/metadata`;
  const acsUrl = existing?.sp?.acsUrl ?? `${API_BASE_URL}/api/saml/${tenant}/acs`;
  const spEntityId = existing?.sp?.entityId ?? `${API_BASE_URL}/api/saml/${tenant}/metadata`;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4 bg-surface-card border border-surface-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-100">IdP configuration</h3>
        <div>
          <label htmlFor="saml-sso-url" className={labelCls}>IdP SSO URL</label>
          <input
            id="saml-sso-url"
            value={ssoUrl}
            onChange={(e) => setSsoUrl(e.target.value)}
            placeholder="https://login.microsoftonline.com/.../saml2"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="saml-entity-id" className={labelCls}>IdP Entity ID (Issuer)</label>
          <input
            id="saml-entity-id"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="https://sts.windows.net/..."
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="saml-cert" className={labelCls}>X.509 signing certificate (PEM)</label>
          <textarea
            id="saml-cert"
            value={cert}
            onChange={(e) => setCert(e.target.value)}
            rows={6}
            placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
            className={`${inputCls} font-mono`}
          />
        </div>
        {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          aria-busy={saving}
          className={`px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 disabled:opacity-60 ${btnGesturePrimary}`}
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save SAML config'}
        </button>
      </div>

      <div className="space-y-4 bg-surface-card border border-surface-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Service provider details</h3>
        <p className="text-xs text-zinc-500">
          Give these values to your IdP admin when registering PushCI as a SAML app.
        </p>
        <div>
          <div className={labelCls}>SP Entity ID</div>
          <code className="block text-xs bg-black/20 border border-surface-border rounded px-2 py-1.5 text-zinc-200 break-all select-all">
            {spEntityId}
          </code>
        </div>
        <div>
          <div className={labelCls}>Assertion Consumer Service (ACS) URL</div>
          <code className="block text-xs bg-black/20 border border-surface-border rounded px-2 py-1.5 text-zinc-200 break-all select-all">
            {acsUrl}
          </code>
        </div>
        <div>
          <div className={labelCls}>SP Metadata</div>
          <a
            href={metadataUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-block px-4 py-2 text-sm font-medium rounded-lg bg-zinc-800/60 border border-surface-border text-zinc-200 hover:bg-zinc-800 ${btnGestureSubtle}`}
          >
            Download metadata XML
          </a>
        </div>
      </div>
    </div>
  );
}
