#!/usr/bin/env node
// Full stranger-customer smoke: register -> project -> SDK call -> cleanup.
// Runs in the pre-push hook via pushci.yml smoke stage.
// Uses an RFC 6761 .test TLD email so nothing hits a real inbox.
// Cleanup is best-effort via wrangler d1; failing it does not fail the smoke.
// Bypass: `git push --no-verify`.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const API = process.env.CLAWPIPE_API_URL || 'https://api.clawpipe.ai';

function rand(n) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
const suffix = rand(8);
const email = `smoke-${suffix}@clawpipe.test`;
const password = rand(24);

function log(label, ok, extra = '') {
  const tag = ok ? 'OK  ' : 'FAIL';
  console.log(`  ${tag} ${label.padEnd(20)} ${extra}`);
}

async function postJson(url, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  return res;
}

async function cleanup(projectId) {
  const sql = [
    `DELETE FROM requests WHERE project_id='${projectId}';`,
    `DELETE FROM project_members WHERE project_id='${projectId}';`,
    `DELETE FROM projects WHERE id='${projectId}';`,
    `DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email='${email}');`,
    `DELETE FROM users WHERE email='${email}';`,
  ].join('\n');
  const tmp = path.join('/tmp', `smoke-cleanup-${process.pid}.sql`);
  fs.writeFileSync(tmp, sql);
  return new Promise((resolve) => {
    execFile(
      'wrangler',
      ['d1', 'execute', 'clawpipe', '--remote', `--file=${tmp}`],
      { cwd: path.join(repoRoot, 'gateway'), timeout: 15000 },
      () => {
        try { fs.unlinkSync(tmp); } catch {}
        resolve();
      },
    );
  });
}

async function main() {
  const total = Date.now();

  // 1. Register
  let t = Date.now();
  const regRes = await postJson(`${API}/auth/register`, { email, password, name: 'Smoke Tester' });
  if (regRes.status !== 201) {
    log('register', false, `HTTP ${regRes.status}`);
    process.exit(1);
  }
  const cookie = regRes.headers.get('set-cookie');
  if (!cookie) { log('register', false, 'no session cookie'); process.exit(1); }
  log('register', true, `${Date.now() - t}ms`);

  // 2. Create project
  t = Date.now();
  const projRes = await postJson(`${API}/v1/projects`, { name: 'Smoke Test Project' }, cookie);
  if (projRes.status !== 201) {
    log('create project', false, `HTTP ${projRes.status}`);
    process.exit(1);
  }
  const { project, apiKey } = await projRes.json();
  if (!project?.id || !apiKey) { log('create project', false, 'missing id/apiKey'); process.exit(1); }
  log('create project', true, `${Date.now() - t}ms`);

  // 3. Live SDK call using the freshly-issued key
  t = Date.now();
  let ClawPipe;
  try {
    ({ ClawPipe } = require(path.join(repoRoot, 'sdk')));
  } catch (err) {
    log('sdk load', false, 'run: cd sdk && npm run build');
    process.exit(1);
  }
  const client = new ClawPipe({
    apiKey, projectId: project.id,
    gatewayUrl: `${API}/v1`,
    enableCache: false, enableBooster: false,
  });
  try {
    const r = await client.prompt('reply with: ok', {
      maxTokens: 5, provider: 'groq', model: 'llama-3.1-8b-instant',
    });
    if (!r?.text) { log('sdk call', false, 'empty response'); process.exit(1); }
    log('sdk call', true, `${Date.now() - t}ms via ${r.meta.route}:${r.meta.model}`);
  } catch (err) {
    log('sdk call', false, err.message.slice(0, 100));
    process.exit(1);
  }

  // 4. Best-effort cleanup — never fails the smoke
  t = Date.now();
  await cleanup(project.id);
  log('cleanup', true, `${Date.now() - t}ms (best effort)`);

  console.log(`  total ${Date.now() - total}ms  (${email})`);
}

main().catch((err) => {
  console.error('  FAIL unexpected:', err.message);
  process.exit(1);
});
