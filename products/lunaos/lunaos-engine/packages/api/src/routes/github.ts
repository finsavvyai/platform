/**
 * GitHub Integration Routes
 *
 * GET    /github/auth          — redirect to GitHub OAuth
 * GET    /github/callback      — handle OAuth callback
 * GET    /github/status        — check connection status
 * DELETE /github/disconnect    — remove connection
 * GET    /github/repos         — list user's repositories
 * POST   /github/repos/:o/:r/index — index a repo via RAG
 * GET    /github/indexed       — list indexed repos
 * POST   /github/webhook       — GitHub push webhook
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuth } from '../middleware/auth';
import {
  fetchRepoTree,
  fetchFileContents,
  indexFilesViaRAG,
} from '../services/github-repo-indexer';

export const githubRoutes = new Hono<{ Bindings: Env }>();

/** GET /github/auth — initiate GitHub OAuth */
githubRoutes.get('/auth', requireAuth, async (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;
  if (!clientId) return c.json({ error: 'GitHub OAuth not configured' }, 500);

  const state = crypto.randomUUID();
  await c.env.KV.put(`github:oauth:${state}`, c.get('userId'), { expirationTtl: 600 });

  const redirectUri = 'https://api.lunaos.ai/github/callback';
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,repo&state=${state}`;
  return c.json({ url });
});

/** GET /github/callback — handle OAuth callback */
githubRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) return c.redirect('https://agents.lunaos.ai/dashboard/repos?error=missing_params');

  const userId = await c.env.KV.get(`github:oauth:${state}`);
  if (!userId) return c.redirect('https://agents.lunaos.ai/dashboard/repos?error=invalid_state');
  await c.env.KV.delete(`github:oauth:${state}`);

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: c.env.GITHUB_CLIENT_ID, client_secret: c.env.GITHUB_CLIENT_SECRET, code }),
  });
  const tokenData = (await tokenRes.json()) as any;
  if (!tokenData.access_token) return c.redirect(`https://agents.lunaos.ai/dashboard/repos?error=${tokenData.error || 'token_failed'}`);

  const ghUser = (await (await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'LunaOS-Engine/1.0' },
  })).json()) as any;
  if (!ghUser.login) return c.redirect('https://agents.lunaos.ai/dashboard/repos?error=user_fetch_failed');

  await c.env.DB.prepare(`
    INSERT INTO github_connections (id, user_id, github_username, github_id, access_token, scopes, connected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET github_username=excluded.github_username, github_id=excluded.github_id, access_token=excluded.access_token, scopes=excluded.scopes, connected_at=excluded.connected_at
  `).bind(crypto.randomUUID(), userId, ghUser.login, String(ghUser.id), tokenData.access_token, tokenData.scope || 'read:user,repo', new Date().toISOString()).run();

  return c.redirect(`https://agents.lunaos.ai/dashboard/repos?connected=true&username=${ghUser.login}`);
});

/** GET /github/status — check if user has GitHub connected */
githubRoutes.get('/status', requireAuth, async (c) => {
  const conn = await c.env.DB.prepare(
    'SELECT github_username, github_id, scopes, connected_at FROM github_connections WHERE user_id = ?',
  ).bind(c.get('userId')).first();

  if (!conn) return c.json({ connected: false });
  return c.json({ connected: true, username: conn.github_username, githubId: conn.github_id, scopes: conn.scopes, connectedAt: conn.connected_at });
});

/** DELETE /github/disconnect */
githubRoutes.delete('/disconnect', requireAuth, async (c) => {
  await c.env.DB.prepare('DELETE FROM github_connections WHERE user_id = ?').bind(c.get('userId')).run();
  return c.json({ success: true });
});

/** GET /github/repos — list user's GitHub repos */
githubRoutes.get('/repos', requireAuth, async (c) => {
  const conn = await c.env.DB.prepare('SELECT access_token FROM github_connections WHERE user_id = ?').bind(c.get('userId')).first() as any;
  if (!conn) return c.json({ error: 'GitHub not connected', connectUrl: '/github/auth' }, 401);

  const page = c.req.query('page') || '1';
  const sort = c.req.query('sort') || 'updated';
  const res = await fetch(`https://api.github.com/user/repos?type=owner&sort=${sort}&per_page=30&page=${page}`, {
    headers: { Authorization: `Bearer ${conn.access_token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'LunaOS-Engine/1.0' },
  });
  if (!res.ok) return c.json({ error: `GitHub API error` }, res.status as any);

  const repos = (await res.json()) as any[];
  const indexed = await c.env.DB.prepare('SELECT repo_full_name FROM indexed_repos WHERE user_id = ?').bind(c.get('userId')).all();
  const indexedSet = new Set((indexed.results || []).map((r: any) => r.repo_full_name));

  return c.json({
    repos: repos.map((r) => ({
      id: r.id, name: r.name, fullName: r.full_name, description: r.description,
      language: r.language, private: r.private, url: r.html_url, updatedAt: r.updated_at,
      starCount: r.stargazers_count, indexed: indexedSet.has(r.full_name),
    })),
    page: parseInt(page), total: repos.length,
  });
});

/** POST /github/repos/:owner/:repo/index — index a repo via RAG */
githubRoutes.post('/repos/:owner/:repo/index', requireAuth, async (c) => {
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  const fullName = `${owner}/${repo}`;
  const conn = await c.env.DB.prepare('SELECT access_token FROM github_connections WHERE user_id = ?').bind(c.get('userId')).first() as any;
  if (!conn) return c.json({ error: 'GitHub not connected' }, 401);

  try {
    const sourceFiles = await fetchRepoTree(fullName, conn.access_token);
    const files = await fetchFileContents(fullName, sourceFiles, conn.access_token);
    if (!files.length) return c.json({ error: 'No indexable files found' }, 400);

    const result = await indexFilesViaRAG(c.env, files, fullName, owner);

    await c.env.DB.prepare(`
      INSERT INTO indexed_repos (id, user_id, repo_full_name, file_count, indexed_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, repo_full_name) DO UPDATE SET file_count=excluded.file_count, indexed_at=excluded.indexed_at
    `).bind(crypto.randomUUID(), c.get('userId'), fullName, files.length, new Date().toISOString()).run();

    return c.json({ success: true, repo: fullName, indexedFiles: files.length, processed: result.processedDocuments });
  } catch (err: any) {
    return c.json({ error: `Indexing failed: ${err.message}` }, 500);
  }
});

/** GET /github/indexed — list indexed repos */
githubRoutes.get('/indexed', requireAuth, async (c) => {
  const results = await c.env.DB.prepare(
    'SELECT repo_full_name, file_count, indexed_at FROM indexed_repos WHERE user_id = ? ORDER BY indexed_at DESC',
  ).bind(c.get('userId')).all();

  return c.json({
    repos: (results.results || []).map((r: any) => ({ fullName: r.repo_full_name, fileCount: r.file_count, indexedAt: r.indexed_at })),
  });
});

/** POST /github/repos/:owner/:repo/pulls — create a PR with LunaOS watermark */
githubRoutes.post('/repos/:owner/:repo/pulls', requireAuth, async (c) => {
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  const body = (await c.req.json()) as { title: string; body: string; head: string; base: string };

  const conn = await c.env.DB.prepare('SELECT access_token FROM github_connections WHERE user_id = ?').bind(c.get('userId')).first() as any;
  if (!conn) return c.json({ error: 'GitHub not connected' }, 401);

  const watermark = '\n\n---\n> 🚀 **Autonomously generated by [LunaOS](https://lunaos.ai)**';
  const finalBody = (body.body || '') + watermark;

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${conn.access_token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'LunaOS-Engine/1.0',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: body.title,
        body: finalBody,
        head: body.head,
        base: body.base
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return c.json({ error: `GitHub API error: ${err}` }, res.status as any);
    }

    const pr = await res.json() as any;
    return c.json({ success: true, url: pr.html_url, number: pr.number });
  } catch (err: any) {
    return c.json({ error: `Failed to create PR: ${err.message}` }, 500);
  }
});

/** POST /github/webhook — GitHub push webhook for continuous sync */
githubRoutes.post('/webhook', async (c) => {
  const event = c.req.header('x-github-event');
  if (!event || event !== 'push') return c.json({ received: true });

  const payload = (await c.req.json()) as any;
  const fullName = payload.repository?.full_name;
  if (!fullName) return c.json({ error: 'Missing repo info' }, 400);

  c.executionCtx.waitUntil((async () => {
    try {
      const indexedRepo = await c.env.DB.prepare('SELECT user_id FROM indexed_repos WHERE repo_full_name = ?').bind(fullName).first() as any;
      if (!indexedRepo) return;
      const conn = await c.env.DB.prepare('SELECT access_token FROM github_connections WHERE user_id = ?').bind(indexedRepo.user_id).first() as any;
      if (!conn) return;

      const sourceFiles = await fetchRepoTree(fullName, conn.access_token);
      const files = await fetchFileContents(fullName, sourceFiles, conn.access_token);
      if (!files.length) return;

      await indexFilesViaRAG(c.env, files, fullName, payload.repository?.owner?.login || '');
      await c.env.DB.prepare('UPDATE indexed_repos SET indexed_at = ?, file_count = ? WHERE user_id = ? AND repo_full_name = ?')
        .bind(new Date().toISOString(), sourceFiles.length, indexedRepo.user_id, fullName).run();
    } catch (err) {
      // Webhook sync errors are silently ignored; webhook is marked as accepted
    }
  })());

  return c.json({ accepted: true }, 202);
});
