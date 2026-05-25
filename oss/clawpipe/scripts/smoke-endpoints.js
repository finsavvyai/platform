#!/usr/bin/env node
// Endpoint reachability smoke for surfaces unbricked by migration 022.
// Each unbricked table backs at least one endpoint. We probe each endpoint
// and treat any non-5xx response (including 4xx validation errors) as healthy
// — a 5xx means the underlying table is gone again (drift recurrence).
//
// Skipped intentionally:
//   POST /v1/webhooks/lemonsqueezy   — HMAC-signed, too involved for smoke
//   webhook_deliveries               — internal cron drain, no public route
'use strict';
const path = require('node:path');

const API = process.env.CLAWPIPE_API_URL || 'https://api.clawpipe.ai';
const rand = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const suffix = rand(8);
const email = `endpoints-${suffix}@clawpipe.test`;
const password = rand(24);

const log = (label, ok, extra = '') => {
  const tag = ok ? 'OK  ' : 'FAIL';
  console.log(`  ${tag} ${label.padEnd(28)} ${extra}`);
};

async function postJson(url, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function probe(label, fn) {
  const t = Date.now();
  try {
    const res = await fn();
    const ok = res.status < 500;
    log(label, ok, `HTTP ${res.status} (${Date.now() - t}ms)`);
    return ok;
  } catch (err) {
    log(label, false, `threw: ${String(err.message).slice(0, 60)}`);
    return false;
  }
}

async function main() {
  const total = Date.now();

  const regRes = await postJson(`${API}/auth/register`, { email, password, name: 'Endpoints Smoke' });
  if (regRes.status !== 201) { log('register', false, `HTTP ${regRes.status}`); process.exit(1); }
  const cookie = regRes.headers.get('set-cookie');
  log('register', true);

  const projRes = await postJson(`${API}/v1/projects`, { name: 'Endpoint Probe' }, cookie);
  if (projRes.status !== 201) { log('create project', false, `HTTP ${projRes.status}`); process.exit(1); }
  const { project, apiKey } = await projRes.json();
  log('create project', true);

  let allOk = true;

  // audit_events (migration 020) — GET requires session cookie + project_id in path
  allOk &= await probe('GET audit events', () =>
    fetch(`${API}/v1/projects/${project.id}/audit/events`, { headers: { cookie } }));

  // provider_keys (migration 017) — GET requires session cookie + project_id in path
  allOk &= await probe('GET provider keys', () =>
    fetch(`${API}/v1/projects/${project.id}/provider-keys`, { headers: { cookie } }));

  // quality_scores (migration 006) — POST with apiKey; malformed body → 4xx is fine
  allOk &= await probe('POST quality', () =>
    fetch(`${API}/v1/quality`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Project-Id': project.id,
      },
      body: JSON.stringify({ request_id: 'probe', score: 0.5, model: 'm', provider: 'p' }),
    }));

  // finops/by-user (migration 018 requests.user_id) — reads requests; smoke needs the column present
  allOk &= await probe('GET finops/by-user', () =>
    fetch(`${API}/v1/finops/by-user?project_id=${project.id}`, { headers: { cookie } }));

  console.log(`  total ${Date.now() - total}ms  (${email})`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => { console.error('  FAIL unexpected:', err.message); process.exit(1); });
