import { useState } from 'react';
import { API_BASE_URL } from '../../config';
import { btnGesturePrimary, btnGestureSubtle } from '../../styles/gestures';
import { ssoApi } from '../../lib/api/sso';
import { labelCls } from './styles';

export default function ScimTab({ tenant }: { tenant: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setGenerating(true);
    setErr(null);
    try {
      const r = await ssoApi.generateScimToken(tenant);
      setToken(r.token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'generate failed');
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const scimBase = `${API_BASE_URL}/scim/v2`;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4 bg-surface-card border border-surface-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-100">SCIM bearer token</h3>
        <p className="text-xs text-zinc-500">
          Paste this token into Azure AD / Okta provisioning as the secret token.
          Generating a new token invalidates the previous one.
        </p>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          aria-busy={generating}
          className={`px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 disabled:opacity-60 ${btnGesturePrimary}`}
        >
          {generating ? 'Generating…' : 'Generate SCIM token'}
        </button>
        {token && (
          <div className="space-y-2">
            <code className="block text-xs bg-black/30 border border-surface-border rounded px-2 py-2 text-zinc-200 break-all font-mono select-all">
              {token}
            </code>
            <button
              type="button"
              onClick={() => void copy()}
              className={`text-xs px-3 py-1.5 rounded-md bg-zinc-800/60 border border-surface-border text-zinc-300 hover:bg-zinc-800 ${btnGestureSubtle}`}
            >
              {copied ? 'Copied' : 'Copy to clipboard'}
            </button>
          </div>
        )}
        {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
      </div>

      <div className="space-y-4 bg-surface-card border border-surface-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Endpoint configuration</h3>
        <div>
          <div className={labelCls}>Tenant URL</div>
          <code className="block text-xs bg-black/20 border border-surface-border rounded px-2 py-1.5 text-zinc-200 break-all select-all">
            {scimBase}/Users?tenant={tenant}
          </code>
        </div>
        <div>
          <div className={labelCls}>ServiceProviderConfig</div>
          <code className="block text-xs bg-black/20 border border-surface-border rounded px-2 py-1.5 text-zinc-200 break-all select-all">
            {scimBase}/ServiceProviderConfig
          </code>
        </div>
        <p className="text-xs text-zinc-500">
          SCIM 2.0 client configuration: use <span className="text-zinc-300">OAuth Bearer Token</span>{' '}
          as the authentication method, and append{' '}
          <span className="text-zinc-300">?tenant={tenant}</span> to the tenant URL.
        </p>
      </div>
    </div>
  );
}
