// Frontend chat action dispatcher — pairs with api/src/chat-actions.ts.
//
// Receives the {action, params} response from /api/nlp/ask and invokes
// the matching backend endpoint. Returns a structured ActionResult the
// chat renderer can display (success/error/polling).
//
// Three actions (deploy / update_config / manage_secret) intentionally
// return a "coming soon" stub instead of hitting any endpoint — they
// require security review per CLAUDE.md and ship in a later sprint.

import { API_BASE_URL } from '../config';

export type ActionState = 'success' | 'error' | 'polling' | 'stub';

export interface ActionResult {
  state: ActionState;
  action: string;
  data?: unknown;
  error?: string;
  runId?: string;
  message?: string;
}

interface DispatchOpts {
  action: string;
  params: Record<string, unknown>;
  token: string;
  repoContext?: { root?: string; branch?: string };
}

interface EndpointSpec {
  method: 'GET' | 'POST';
  path: string;
  async?: boolean; // true = response includes run_id, poll for status
}

const ENDPOINTS: Record<string, EndpointSpec> = {
  generate_pipeline: { method: 'POST', path: '/api/ai/generate-pipeline' },
  diagnose_failure: { method: 'POST', path: '/api/remediate/diagnose' },
  fix_pipeline: { method: 'POST', path: '/api/autofix/suggest-fix' },
  heal_pipeline: { method: 'POST', path: '/api/autofix/root-cause' },
  show_status: { method: 'GET', path: '/api/chat/status' },
  optimize_pipeline: { method: 'POST', path: '/api/chat/optimize-pipeline' },
  run_pipeline: { method: 'POST', path: '/api/chat/run', async: true },
};

const STUBS: Record<string, { message: string; eta: string }> = {
  deploy: {
    message:
      'Direct deploy from chat is in development. For now use the dashboard ' +
      'Deploy page or `pushci deploy` CLI command, both of which go through ' +
      'governance approval gates as configured for your project.',
    eta: 'Q1 2027',
  },
  update_config: {
    message:
      'Editing pushci.yml from chat is in development. For now edit your ' +
      'pipeline file in your repo directly and commit; PushCI will pick up ' +
      'the change on next run.',
    eta: 'Q4 2026',
  },
  manage_secret: {
    message:
      'Secrets management via chat is in development pending our security ' +
      'review. For now use `pushci secret set <KEY>` from the CLI or the ' +
      'Secrets page in the dashboard.',
    eta: 'Q1 2027',
  },
};

function buildBody(
  action: string,
  params: Record<string, unknown>,
  repoContext?: { root?: string; branch?: string },
): Record<string, unknown> {
  // Most endpoints accept the params as-is. Layer repoContext on top
  // for actions that need it: run_pipeline (repo/branch), and the
  // existing AI endpoints that accept a `repoName` field.
  const body: Record<string, unknown> = { ...params };
  if (repoContext?.root) {
    if (action === 'run_pipeline') {
      body.repo = body.repo || repoContext.root;
      body.branch = body.branch || repoContext.branch;
    } else {
      body.repoName = body.repoName || repoContext.root;
    }
  }
  return body;
}

async function callEndpoint(
  spec: EndpointSpec,
  body: Record<string, unknown>,
  token: string,
): Promise<Response> {
  const url = `${API_BASE_URL}${spec.path}`;
  if (spec.method === 'GET') {
    return fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; message?: string };
    if (j.error === 'upgrade_required') {
      return j.message || 'This feature requires a paid plan.';
    }
    return j.message || j.error || `Request failed with status ${res.status}`;
  } catch {
    return `Request failed with status ${res.status}`;
  }
}

export async function dispatchAction(opts: DispatchOpts): Promise<ActionResult> {
  const { action, params, token, repoContext } = opts;

  // 1. Stubs for deferred actions — never touch the backend.
  if (STUBS[action]) {
    const stub = STUBS[action];
    return {
      state: 'stub',
      action,
      message: `${stub.message} (Coming ${stub.eta}.)`,
    };
  }

  // 2. Unknown action — surface clearly rather than silently doing nothing.
  const spec = ENDPOINTS[action];
  if (!spec) {
    return {
      state: 'error',
      action,
      error: `Unknown action: ${action}. The assistant requested an action ` +
        `the dashboard does not know how to dispatch.`,
    };
  }

  // 3. Real dispatch.
  try {
    const body = buildBody(action, params, repoContext);
    const res = await callEndpoint(spec, body, token);
    if (!res.ok) {
      return { state: 'error', action, error: await parseError(res) };
    }
    const data = await res.json();

    // Async actions return a run_id — surface polling state to the UI,
    // which calls pollRunStatus separately.
    if (spec.async) {
      const runId = (data as { run_id?: string }).run_id;
      if (runId) {
        return { state: 'polling', action, runId, data };
      }
    }

    return { state: 'success', action, data };
  } catch (err) {
    return {
      state: 'error',
      action,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

