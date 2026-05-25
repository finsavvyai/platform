// GitHubActionsDispatchForm — dispatches a workflow_dispatch event.
// Renders the workflow's declared inputs, respects `required` fields,
// and pre-fills defaults. Hidden unless the selected workflow supports dispatch.
// License: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import type { GHAWorkflow } from '../hooks/useGitHubActionsBridge';
import { btnGesturePrimary } from '../styles/gestures';

interface Props {
  workflow: GHAWorkflow | null;
  defaultRef: string;
  onDispatch: (payload: { workflowId: number; ref: string; inputs: Record<string, string> }) => Promise<void>;
  dispatching?: boolean;
  error?: string | null;
  successMessage?: string | null;
}

const card = 'rounded-xl border border-surface-border bg-surface-card p-4';
const inputCls =
  'w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent/50';
const labelCls = 'block text-xs text-zinc-400 mb-1';

export default function GitHubActionsDispatchForm({
  workflow, defaultRef, onDispatch, dispatching = false, error = null, successMessage = null,
}: Props) {
  const [ref, setRef] = useState(defaultRef);
  const [inputs, setInputs] = useState<Record<string, string>>({});

  useEffect(() => { setRef(defaultRef); }, [defaultRef]);

  useEffect(() => {
    if (!workflow?.inputs) { setInputs({}); return; }
    const seed: Record<string, string> = {};
    for (const inp of workflow.inputs) seed[inp.name] = inp.default ?? '';
    setInputs(seed);
  }, [workflow?.id, workflow?.inputs]);

  const missingRequired = useMemo(() => {
    if (!workflow?.inputs) return [] as string[];
    return workflow.inputs
      .filter((i) => i.required && !inputs[i.name]?.trim())
      .map((i) => i.name);
  }, [workflow?.inputs, inputs]);

  if (!workflow) {
    return (
      <section className={card} aria-label="Dispatch workflow">
        <p className="text-xs text-zinc-500">Select a workflow to dispatch a manual run.</p>
      </section>
    );
  }

  if (!workflow.has_workflow_dispatch) {
    return (
      <section className={card} aria-label="Dispatch workflow">
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-300">{workflow.name}</span> does not declare <code>workflow_dispatch</code>. Add
          <code className="px-1">on: workflow_dispatch</code> in the workflow YAML to trigger it manually.
        </p>
      </section>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!workflow || missingRequired.length > 0 || dispatching) return;
    await onDispatch({ workflowId: workflow.id, ref: ref.trim() || defaultRef, inputs });
  }

  return (
    <section className={card} aria-label="Dispatch workflow">
      <h3 className="text-sm font-semibold text-zinc-100 mb-1">Dispatch {workflow.name}</h3>
      <p className="text-xs text-zinc-500 mb-3">
        Triggers <code className="font-mono">workflow_dispatch</code> against the selected ref.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="gha-dispatch-ref" className={labelCls}>Ref (branch or tag)</label>
          <input
            id="gha-dispatch-ref" type="text" value={ref} onChange={(e) => setRef(e.target.value)}
            placeholder={defaultRef} className={inputCls}
          />
        </div>

        {workflow.inputs && workflow.inputs.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {workflow.inputs.map((inp) => (
              <div key={inp.name}>
                <label htmlFor={`gha-input-${inp.name}`} className={labelCls}>
                  {inp.name}{inp.required && <span className="text-red-400"> *</span>}
                </label>
                <input
                  id={`gha-input-${inp.name}`}
                  type="text"
                  value={inputs[inp.name] ?? ''}
                  onChange={(e) => setInputs((s) => ({ ...s, [inp.name]: e.target.value }))}
                  placeholder={inp.default ?? inp.description ?? ''}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
            {error}
          </div>
        )}

        {successMessage && (
          <div role="status" className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={dispatching || missingRequired.length > 0}
          className={`px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${btnGesturePrimary}`}
        >
          {dispatching ? 'Dispatching…' : 'Dispatch workflow'}
        </button>
      </form>
    </section>
  );
}
