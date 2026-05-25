// Route: <Route path="/migrate" element={<MigrationWizardPage />} /> in App.tsx.
import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';
import MarketplaceActionImport from '../components/MarketplaceActionImport';
import BuildspecPasteImport from '../components/BuildspecPasteImport';
import MigrationStepper from '../components/MigrationStepper';
import { sources, apiFetch, type SourceId } from './migrationWizardData';

type ImportTab = 'platform' | 'buildspec' | 'action';
interface PreviewResult { yaml: string; warnings: string[] }

const TABS: ReadonlyArray<readonly [ImportTab, string]> = [
  ['platform', 'Full CI platform'],
  ['buildspec', 'buildspec.yml'],
  ['action', 'Marketplace action'],
];

export default function MigrationWizardPage() {
  const [step, setStep] = useState(1);
  const [sourceId, setSourceId] = useState<SourceId | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [projectName, setProjectName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [created, setCreated] = useState<{ id: string } | null>(null);
  const [tab, setTab] = useState<ImportTab>('platform');

  const selectedSource = useMemo(
    () => sources.find((s) => s.id === sourceId) ?? null,
    [sourceId],
  );

  const canAdvance =
    (step === 1 && sourceId !== null) ||
    (step === 2 && selectedSource !== null && selectedSource.credentialFields.every((f) => credentials[f.key]?.trim())) ||
    (step === 3 && preview !== null) ||
    step === 4;

  const runPreview = async () => {
    if (!selectedSource) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ yaml?: string; warnings?: string[] }>(
        selectedSource.endpoint,
        { method: 'POST', body: JSON.stringify({ credentials, dryRun: true }) },
      );
      if (!res?.yaml) {
        setError('Import preview returned no pipeline. Verify credentials and try again.');
        return;
      }
      setPreview({ yaml: res.yaml, warnings: res.warnings ?? [] });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed. Check credentials and try again.');
    } finally { setBusy(false); }
  };

  const runCreate = async () => {
    if (!selectedSource || !preview) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ id: string }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: projectName || `${selectedSource.name} import`,
          source: selectedSource.id, pushciYaml: preview.yaml,
        }),
      });
      if (!res?.id) {
        setError('Project creation returned no id. The backend may be unreachable.');
        return;
      }
      setCreated(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Project creation failed. Please try again.');
    } finally { setBusy(false); }
  };

  const handleNext = () => {
    setError(null);
    if (step === 2) return runPreview();
    if (step === 3) return setStep(4);
    if (step === 4) return runCreate();
    setStep((s) => s + 1);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Migration Wizard"
        description="Import pipelines from Jenkins, Gerrit, AWS CodePipeline, or a pasted buildspec.yml into PushCI."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <MigrationStepper step={step} />
        <main className="rounded-xl border border-surface-border bg-surface-card p-6 min-h-[420px]">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          {step === 1 && (
            <div className="space-y-6">
              <nav role="tablist" aria-label="Import source" className="flex gap-2 border-b border-surface-border">
                {TABS.map(([id, label]) => (
                  <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}
                    className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === id ? 'border-accent text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                  >{label}</button>
                ))}
              </nav>
              {tab === 'buildspec' && <BuildspecPasteImport />}
              {tab === 'action' && <MarketplaceActionImport />}
              {tab === 'platform' && (
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100 mb-1">Choose source</h2>
                  <p className="text-sm text-zinc-500 mb-5">Select a full CI system to migrate from.</p>
                  <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                    {sources.map((s) => (
                      <button key={s.id} type="button" onClick={() => setSourceId(s.id)}
                        className={`text-left rounded-lg border p-4 transition-colors ${sourceId === s.id ? 'border-accent/50 bg-accent/5' : 'border-surface-border bg-surface hover:border-zinc-700'}`}
                      >
                        <div className="text-zinc-100 font-semibold">{s.name}</div>
                        <div className="text-xs text-zinc-500 mt-1 leading-relaxed">{s.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {step === 2 && selectedSource && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-1">Connect {selectedSource.name}</h2>
              <p className="text-sm text-zinc-500 mb-5">Credentials are encrypted with AES-256-GCM before storage.</p>
              <div className="space-y-4 max-w-lg">
                {selectedSource.credentialFields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs text-zinc-400 mb-1">{f.label}</label>
                    <input type={f.type ?? 'text'} value={credentials[f.key] ?? ''}
                      onChange={(e) => setCredentials((c) => ({ ...c, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 3 && preview && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-1">Preview converted .pushci.yml</h2>
              <p className="text-sm text-zinc-500 mb-5">Review the generated pipeline. You can edit it after the project is created.</p>
              <pre className="bg-surface border border-surface-border rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto max-h-80">
                {preview.yaml}
              </pre>
              {preview.warnings.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-amber-400 mb-2">Import warnings</div>
                  <ul className="space-y-1">
                    {preview.warnings.map((w) => (<li key={w} className="text-xs text-zinc-400">- {w}</li>))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {step === 4 && !created && selectedSource && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-1">Create project</h2>
              <p className="text-sm text-zinc-500 mb-5">Give the imported project a name and confirm to create it in PushCI.</p>
              <div className="max-w-lg">
                <label className="block text-xs text-zinc-400 mb-1">Project name</label>
                <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                  placeholder={`${selectedSource.name} import`}
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>
          )}
          {step === 4 && created && (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold">OK</div>
              <h2 className="text-lg font-semibold text-zinc-100 mt-4">Project created</h2>
              <p className="text-sm text-zinc-500 mt-2">Project <span className="font-mono text-zinc-300">{created.id}</span> is ready.</p>
            </div>
          )}
          <div className="mt-8 pt-6 border-t border-surface-border flex items-center justify-between">
            <button type="button" onClick={() => { setError(null); setStep((s) => Math.max(1, s - 1)); }}
              disabled={step === 1 || busy || !!created}
              className={`px-4 py-2 rounded-lg text-sm font-medium border border-surface-border bg-surface-card text-zinc-300 hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed ${btnGestureSubtle}`}
            >Back</button>
            {!created && (
              <button type="button" onClick={handleNext} disabled={!canAdvance || busy}
                className={`px-5 py-2 rounded-lg text-sm font-semibold bg-accent text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${btnGesturePrimary}`}
              >{busy ? 'Working...' : step === 4 ? 'Create project' : 'Next'}</button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
