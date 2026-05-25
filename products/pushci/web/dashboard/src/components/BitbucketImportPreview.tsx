// BitbucketImportPreview — renders the translated .pushci.yml from the
// /api/bitbucket/import endpoint, surfaces warnings, and offers a Save action.
// License: Apache-2.0

import type { ImportPreview } from '../hooks/useBitbucketBridge';
import { SkeletonCard } from './Skeleton';
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';

interface Props {
  preview: ImportPreview | null;
  loading?: boolean;
  error?: string | null;
  saving?: boolean;
  onImport: () => Promise<void>;
  onSave: () => Promise<void>;
  disabled?: boolean;
}

const card = 'rounded-xl border border-surface-border bg-surface-card p-4';

export default function BitbucketImportPreview({
  preview, loading = false, error = null, saving = false, onImport, onSave, disabled = false,
}: Props) {
  return (
    <section className={card} aria-label="Import preview">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Converted .pushci.yml</h3>
          <p className="text-xs text-zinc-500">
            Parsed from <span className="font-mono">bitbucket-pipelines.yml</span> — review before saving.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onImport} disabled={loading || disabled}
            className={`px-3 py-1.5 rounded-lg text-xs text-zinc-300 border border-surface-border disabled:opacity-40 disabled:cursor-not-allowed ${btnGestureSubtle}`}>
            {loading ? 'Importing…' : preview ? 'Re-import' : 'Import'}
          </button>
          <button type="button" onClick={onSave} disabled={!preview || saving}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${btnGesturePrimary}`}>
            {saving ? 'Saving…' : 'Save to project'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      {loading && !preview && <SkeletonCard height="h-48" />}

      {!loading && !preview && !error && (
        <p className="text-xs text-zinc-500">
          Click <span className="text-zinc-300">Import</span> to fetch the pipeline file from the selected repository.
        </p>
      )}

      {preview && (
        <div className="space-y-4">
          <pre className="bg-surface border border-surface-border rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto max-h-80">
{preview.preview.yaml}
          </pre>

          {preview.preview.pipeline.warnings.length > 0 && (
            <div>
              <div className="text-xs font-medium text-amber-400 mb-2">Import warnings</div>
              <ul className="space-y-1" aria-label="Import warnings">
                {preview.preview.pipeline.warnings.map((w, i) => (
                  <li key={`${i}-${w}`} className="text-xs text-zinc-400">- {w}</li>
                ))}
              </ul>
            </div>
          )}

          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-300">View original bitbucket-pipelines.yml</summary>
            <pre className="mt-2 bg-surface border border-surface-border rounded-lg p-3 overflow-x-auto max-h-60 text-zinc-400">
{preview.preview.source}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}
