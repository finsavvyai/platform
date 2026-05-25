/** Prompt store REST handlers — CRUD for named/versioned templates. */
import type { Env } from './types';
import { expandTemplate, extractVariables } from './prompt-template';

interface PromptRow { id: string; name: string; description: string | null; updated_at: string }
interface VersionRow {
  id: string; prompt_id: string; version: number; template: string;
  system: string | null; model: string | null; variables: string | null;
  notes: string | null; created_at: string;
}

/** GET /v1/prompts — list all prompts for project. */
export async function listPrompts(env: Env, projectId: string): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT id, name, description, updated_at FROM prompts WHERE project_id = ? ORDER BY name`,
  ).bind(projectId).all<PromptRow>();
  return Response.json({ prompts: rows.results ?? [] });
}

/** POST /v1/prompts — create (name, description, template, system?, model?). */
export async function createPrompt(req: Request, env: Env, projectId: string): Promise<Response> {
  let body: { name?: string; description?: string; template?: string; system?: string; model?: string; notes?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.name || !body.template) return Response.json({ error: 'name and template required' }, { status: 400 });
  if (body.name.length > 100 || body.template.length > 50_000) return Response.json({ error: 'name or template too large' }, { status: 413 });

  const promptId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const vars = JSON.stringify(extractVariables(body.template));

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO prompts (id, project_id, name, description) VALUES (?, ?, ?, ?)`,
      ).bind(promptId, projectId, body.name, body.description ?? null),
      env.DB.prepare(
        `INSERT INTO prompt_versions (id, prompt_id, version, template, system, model, variables, notes)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
      ).bind(versionId, promptId, body.template, body.system ?? null, body.model ?? null, vars, body.notes ?? null),
    ]);
  } catch (e) {
    return Response.json({ error: `prompt creation failed: ${(e as Error).message}` }, { status: 400 });
  }
  return Response.json({ id: promptId, version: 1, variables: JSON.parse(vars) }, { status: 201 });
}

/** GET /v1/prompts/:id/versions — list all versions for a prompt. */
export async function listVersions(env: Env, projectId: string, promptId: string): Promise<Response> {
  const prompt = await env.DB.prepare(
    'SELECT id FROM prompts WHERE id = ? AND project_id = ?',
  ).bind(promptId, projectId).first<{ id: string }>();
  if (!prompt) return Response.json({ error: 'prompt not found' }, { status: 404 });
  const rows = await env.DB.prepare(
    'SELECT id, version, notes, created_at FROM prompt_versions WHERE prompt_id = ? ORDER BY version DESC',
  ).bind(promptId).all<{ id: string; version: number; notes: string | null; created_at: string }>();
  return Response.json({ versions: rows.results ?? [] });
}

/** POST /v1/prompts/:id/versions — create a new version for an existing prompt. */
export async function createVersion(req: Request, env: Env, projectId: string, promptId: string): Promise<Response> {
  let body: { template?: string; system?: string; model?: string; notes?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.template) return Response.json({ error: 'template required' }, { status: 400 });

  const existing = await env.DB.prepare(
    'SELECT id FROM prompts WHERE id = ? AND project_id = ?',
  ).bind(promptId, projectId).first<{ id: string }>();
  if (!existing) return Response.json({ error: 'prompt not found' }, { status: 404 });

  const maxRow = await env.DB.prepare(
    'SELECT MAX(version) as v FROM prompt_versions WHERE prompt_id = ?',
  ).bind(promptId).first<{ v: number | null }>();
  const nextVersion = (maxRow?.v ?? 0) + 1;
  const vars = JSON.stringify(extractVariables(body.template));

  try {
    await env.DB.prepare(
      'INSERT INTO prompt_versions (id, prompt_id, version, template, system, model, variables, notes) VALUES (?,?,?,?,?,?,?,?)',
    ).bind(crypto.randomUUID(), promptId, nextVersion, body.template, body.system ?? null, body.model ?? null, vars, body.notes ?? null).run();
    return Response.json({ prompt_id: promptId, version: nextVersion }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** POST /v1/prompts/:id/render — expand template with vars, return final prompt. */
export async function renderPrompt(
  req: Request, env: Env, projectId: string, promptId: string,
): Promise<Response> {
  let body: { variables?: Record<string, unknown>; version?: number };
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }

  const versionClause = body.version ? `AND pv.version = ?` : `ORDER BY pv.version DESC LIMIT 1`;
  const sql = `SELECT pv.template, pv.system, pv.model, pv.variables
               FROM prompt_versions pv JOIN prompts p ON p.id = pv.prompt_id
               WHERE p.project_id = ? AND p.id = ? ${versionClause}`;
  const stmt = body.version
    ? env.DB.prepare(sql).bind(projectId, promptId, body.version)
    : env.DB.prepare(sql).bind(projectId, promptId);
  const row = await stmt.first<Pick<VersionRow, 'template' | 'system' | 'model' | 'variables'>>();
  if (!row) return Response.json({ error: 'prompt not found' }, { status: 404 });

  try {
    const prompt = expandTemplate(row.template, body.variables ?? {});
    const system = row.system ? expandTemplate(row.system, body.variables ?? {}) : null;
    return Response.json({ prompt, system, model: row.model, required: row.variables ? JSON.parse(row.variables) : [] });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
