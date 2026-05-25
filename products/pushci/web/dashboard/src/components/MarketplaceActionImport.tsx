// MarketplaceActionImport — paste a GitHub Actions marketplace ref,
// resolve via /api/marketplace/resolve, fill `with:` inputs, and copy
// the generated pushci.yml stage. Usable standalone or inside any
// importer page (Migration Wizard action tab, /import/action, etc.).

import { useCallback, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';

export interface ActionInput {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
  readonly default: string | null;
}

export interface ResolvedAction {
  readonly ref: string;
  readonly owner: string;
  readonly repo: string;
  readonly subpath: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly inputs: ActionInput[];
  readonly warnings: string[];
  readonly sourceUrl: string;
}

export interface ResolveResponse { action: ResolvedAction; yaml: string }
type ResolveFn = (ref: string, inputs: Record<string, string>) => Promise<ResolveResponse>;

async function defaultResolve(
  ref: string, inputs: Record<string, string>,
): Promise<ResolveResponse> {
  const token = localStorage.getItem('pushci_token');
  const res = await fetch(`${API_BASE_URL}/api/marketplace/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ actionRef: ref, inputs }),
  });
  if (!res.ok) throw new Error(`resolve failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as ResolveResponse;
}

export interface MarketplaceActionImportProps {
  readonly resolveFn?: ResolveFn;
  readonly onAccept?: (yaml: string, action: ResolvedAction) => void;
}

export default function MarketplaceActionImport({
  resolveFn, onAccept,
}: MarketplaceActionImportProps): JSX.Element {
  const resolve = resolveFn ?? defaultResolve;
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedAction | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [yaml, setYaml] = useState('');
  const [copied, setCopied] = useState(false);

  const runResolve = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const res = await resolve(ref.trim(), {});
      setResolved(res.action);
      const next: Record<string, string> = {};
      for (const i of res.action.inputs) if (i.default !== null) next[i.name] = i.default;
      setValues(next);
      setYaml(res.yaml);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResolved(null);
    } finally { setBusy(false); }
  }, [ref, resolve]);

  const rerender = useCallback(async () => {
    if (!resolved) return;
    setBusy(true);
    try {
      const res = await resolve(resolved.ref, values);
      setYaml(res.yaml);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }, [resolve, resolved, values]);

  const copyYaml = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { setError('clipboard copy failed — select the YAML manually'); }
  }, [yaml]);

  const submitDisabled = useMemo(() => busy || !ref.trim(), [busy, ref]);

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5 space-y-4">
      <header>
        <h3 className="text-base font-semibold text-zinc-100">Import marketplace action</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Paste a ref like <code className="text-zinc-300">actions/setup-node@v4</code>. We fetch the
          action.yml and pre-fill its inputs so you can copy the stage.
        </p>
      </header>
      <div className="flex gap-2">
        <input type="text" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="owner/repo@ref"
          className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
          data-testid="marketplace-ref-input" />
        <button type="button" onClick={runResolve} disabled={submitDisabled}
          className={`px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-zinc-900 disabled:opacity-40 ${btnGesturePrimary}`}
          data-testid="marketplace-resolve-btn">
          {busy ? 'Resolving...' : 'Resolve'}
        </button>
      </div>
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
      )}
      {resolved && (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-zinc-200">{resolved.name}</div>
            {resolved.description && <div className="text-xs text-zinc-500 mt-1">{resolved.description}</div>}
            {resolved.warnings.map((w) => (
              <div key={w} className="text-xs text-amber-400 mt-2">Warning: {w}</div>
            ))}
          </div>
          {resolved.inputs.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Inputs</div>
              {resolved.inputs.map((i) => (
                <label key={i.name} className="block">
                  <span className="block text-xs text-zinc-400 mb-1">
                    {i.name}{i.required ? ' *' : ''}
                    {i.description && <span className="text-zinc-600"> — {i.description}</span>}
                  </span>
                  <input type="text" value={values[i.name] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [i.name]: e.target.value }))}
                    placeholder={i.default ?? ''}
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-accent/50" />
                </label>
              ))}
              <button type="button" onClick={rerender} disabled={busy}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-border bg-surface text-zinc-300 ${btnGestureSubtle}`}>
                Regenerate YAML
              </button>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Stage YAML</div>
              <div className="flex gap-2">
                <button type="button" onClick={copyYaml}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-border bg-surface text-zinc-300 ${btnGestureSubtle}`}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {onAccept && (
                  <button type="button" onClick={() => onAccept(yaml, resolved)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-zinc-900 ${btnGestureSubtle}`}>
                    Accept
                  </button>
                )}
              </div>
            </div>
            <pre className="bg-surface border border-surface-border rounded-lg p-3 text-xs text-zinc-300 overflow-x-auto" data-testid="marketplace-yaml">{yaml}</pre>
          </div>
        </div>
      )}
    </section>
  );
}
