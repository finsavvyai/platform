// BuildspecPasteImport — paste an AWS CodeBuild buildspec.yml and receive
// a .pushci.yml draft, warnings, and env vars the user still needs to set.
// Mounted as a tab inside MigrationWizardPage.

import { useCallback, useState } from 'react';
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';
import { useBuildspecMigrate, type BuildspecMigrateFn } from '../hooks/useBuildspecMigrate';

const PLACEHOLDER = `version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 20
  build:
    commands:
      - npm ci
      - npm test
      - npm run build
artifacts:
  files:
    - '**/*'`;

export interface BuildspecPasteImportProps {
  readonly migrateFn?: BuildspecMigrateFn;
}

export default function BuildspecPasteImport({
  migrateFn,
}: BuildspecPasteImportProps): JSX.Element {
  const { result, loading, error, migrate, reset } = useBuildspecMigrate(migrateFn);
  const [yaml, setYaml] = useState('');
  const [copied, setCopied] = useState(false);

  const disabled = loading || yaml.trim().length === 0;

  const onConvert = useCallback(() => {
    void migrate(yaml);
  }, [migrate, yaml]);

  const onCopy = useCallback(async () => {
    if (!result?.pushciYaml) return;
    try {
      await navigator.clipboard.writeText(result.pushciYaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable; user can select text manually */
    }
  }, [result]);

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5 space-y-4">
      <header>
        <h3 className="text-base font-semibold text-zinc-100">
          Import AWS CodeBuild buildspec
        </h3>
        <p className="text-xs text-zinc-500 mt-1">
          Paste a <code className="text-zinc-300">buildspec.yml</code> and we convert
          it to a <code className="text-zinc-300">.pushci.yml</code> draft with warnings
          for anything that does not map cleanly.
        </p>
      </header>

      <label className="block">
        <span className="sr-only">buildspec.yml</span>
        <textarea
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={12}
          spellCheck={false}
          aria-label="buildspec.yml input"
          data-testid="buildspec-input"
          className="w-full font-mono bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-accent/50"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConvert}
          disabled={disabled}
          data-testid="buildspec-convert-btn"
          className={`px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${btnGesturePrimary}`}
        >
          {loading ? 'Converting...' : 'Convert'}
        </button>
        {(result || error) && (
          <button
            type="button"
            onClick={() => { setYaml(''); reset(); }}
            disabled={loading}
            className={`px-3 py-2 rounded-lg text-xs font-medium border border-surface-border bg-surface text-zinc-300 ${btnGestureSubtle}`}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          data-testid="buildspec-error"
          className="flex items-start justify-between gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onConvert}
            className={`px-2 py-0.5 rounded border border-red-500/40 text-xs ${btnGestureSubtle}`}
          >
            Retry
          </button>
        </div>
      )}

      {loading && !result && (
        <div data-testid="buildspec-skeleton" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 rounded-lg bg-surface border border-surface-border animate-pulse" />
          <div className="h-64 rounded-lg bg-surface border border-surface-border animate-pulse" />
        </div>
      )}

      {!loading && !result && !error && (
        <div
          data-testid="buildspec-empty"
          className="rounded-lg border border-dashed border-surface-border bg-surface/40 p-6 text-center text-xs text-zinc-500"
        >
          Paste your buildspec.yml to convert.
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Generated .pushci.yml
              </div>
              <button
                type="button"
                onClick={onCopy}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-border bg-surface text-zinc-300 ${btnGestureSubtle}`}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre
              data-testid="buildspec-yaml"
              className="bg-surface border border-surface-border rounded-lg p-3 text-xs text-zinc-300 overflow-x-auto max-h-80"
            >
              {result.pushciYaml}
            </pre>
          </div>

          <div className="space-y-4">
            {result.warnings.length > 0 && (
              <div>
                <div className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">
                  Warnings ({result.warnings.length})
                </div>
                <ul className="space-y-1" data-testid="buildspec-warnings">
                  {result.warnings.map((w) => (
                    <li key={w} className="text-xs text-zinc-400 leading-relaxed">- {w}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.envVarsNeeded.length > 0 && (
              <div>
                <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                  Env vars to set
                </div>
                <ul className="space-y-2" data-testid="buildspec-envvars">
                  {result.envVarsNeeded.map((v) => (
                    <li key={v.name} className="rounded border border-surface-border bg-surface px-3 py-2">
                      <div className="text-xs font-mono text-zinc-200">{v.name}</div>
                      {v.suggestion && (
                        <div className="text-[11px] text-zinc-500 mt-0.5">{v.suggestion}</div>
                      )}
                      <code className="block mt-1 text-[11px] font-mono text-emerald-400">
                        pushci secret set {v.name} &lt;value&gt;
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.warnings.length === 0 && result.envVarsNeeded.length === 0 && (
              <div className="text-xs text-emerald-400">
                Clean conversion — no warnings or env vars needed.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
