// Displays the parsed .pushci.yml preview produced by POST /api/gitlab/import
// along with unmapped-keyword warnings and an accept CTA.
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';
import type { GitLabImportPreview } from '../hooks/useGitLabBridge';

interface Props {
  preview: GitLabImportPreview | null;
  loading: boolean;
  saving: boolean;
  error?: string | null;
  onAccept: (yaml: string) => Promise<void> | void;
  onCancel: () => void;
}

function deriveWarnings(preview: GitLabImportPreview): string[] {
  const warnings: string[] = [];
  const src = preview.source;
  if (/^\s*include\s*:/m.test(src)) {
    warnings.push('include: directives are not translated — inline the referenced files before running.');
  }
  if (/^\s*services\s*:/m.test(src)) {
    warnings.push('services: block detected — map to PushCI service containers manually.');
  }
  if (/^\s*rules\s*:/m.test(src) || /^\s*only\s*:/m.test(src) || /^\s*except\s*:/m.test(src)) {
    warnings.push('Conditional rules (rules/only/except) are not fully represented in the preview.');
  }
  if (preview.pipeline.jobs.length === 0) {
    warnings.push('No jobs detected. Review the source .gitlab-ci.yml.');
  }
  return warnings;
}

export default function GitLabImportPreviewCard({
  preview, loading, saving, error, onAccept, onCancel,
}: Props) {
  if (loading) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-card p-5" aria-busy="true">
        <div className="h-4 w-48 rounded shimmer mb-3" />
        <div className="h-40 rounded shimmer" />
      </section>
    );
  }

  if (!preview) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-card p-5 text-center text-xs text-zinc-500">
        Select a project and choose <strong className="text-zinc-300">Import .gitlab-ci.yml</strong> to see a preview here.
      </section>
    );
  }

  const warnings = deriveWarnings(preview);

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5 space-y-4" aria-label="Import preview">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Import preview</h3>
          <p className="text-xs text-zinc-500 mt-1">
            {preview.pipeline.jobs.length} job(s) across {preview.pipeline.stages.length} stage(s).
          </p>
        </div>
      </header>

      <pre
        data-testid="pushci-yaml"
        className="bg-surface border border-surface-border rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto max-h-80"
      >{preview.yaml}</pre>

      {warnings.length > 0 && (
        <div>
          <div className="text-xs font-medium text-amber-400 mb-2">Warnings</div>
          <ul className="space-y-1">
            {warnings.map((w) => (
              <li key={w} className="text-xs text-zinc-400">– {w}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium border border-surface-border bg-surface-card text-zinc-300 hover:bg-surface-hover disabled:opacity-40 ${btnGestureSubtle}`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onAccept(preview.yaml)}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${btnGesturePrimary}`}
        >
          {saving ? 'Saving…' : 'Accept & save as .pushci.yml'}
        </button>
      </div>
    </section>
  );
}
