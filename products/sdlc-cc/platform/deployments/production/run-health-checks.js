#!/usr/bin/env node
/**
 * Standalone post-deploy health check script.
 * Run after deploy or against staging/production to verify endpoints.
 * Usage: GATEWAY_URL=https://api.sdlc.cc node run-health-checks.js
 * Exit code: 0 if all pass, 1 if any fail.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080';
const RAG_URL = process.env.RAG_URL || '';
const LANDING_URL = process.env.LANDING_URL || 'https://sdlc.cc';
const GATEWAY_REQUIRED = process.env.GATEWAY_REQUIRED !== 'false';

const ENDPOINTS = [
  ...(GATEWAY_REQUIRED ? [{ name: 'Gateway', url: `${GATEWAY_URL}/api/health`, required: true }] : [{ name: 'Gateway', url: `${GATEWAY_URL}/api/health`, required: false }]),
  ...(RAG_URL ? [{ name: 'RAG', url: `${RAG_URL}/api/rag/health`, required: false }] : []),
  { name: 'Landing', url: LANDING_URL, required: true }
];

async function check(url, name) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
    clearTimeout(t);
    const ok = res.ok;
    console.log(ok ? `✓ ${name}: ${res.status}` : `✗ ${name}: ${res.status}`);
    return ok;
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('Post-deploy health checks');
  console.log('Gateway:', GATEWAY_URL, GATEWAY_REQUIRED ? '(required)' : '(optional)', 'RAG:', RAG_URL || '(skip)', 'Landing:', LANDING_URL);
  let allOk = true;
  for (const ep of ENDPOINTS) {
    const ok = await check(ep.url, ep.name);
    if (ep.required && !ok) allOk = false;
    else if (!ep.required && !ok) console.log(`  (${ep.name} optional, skipping failure)`);
  }
  process.exit(allOk ? 0 : 1);
}

main();
