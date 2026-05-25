const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const open_pr = require('./open_pr');
const { OpenPRTool, mintJWT } = open_pr;

const KEY_PATH = path.join(__dirname, '..', 'test-fixtures', 'test-private-key.pem');
const PRIVATE_KEY = fs.readFileSync(KEY_PATH, 'utf8');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function mockFetch(responses) {
  const calls = [];
  let i = 0;
  const fn = async (url, opts = {}) => {
    calls.push({ url, opts });
    return responses[i++];
  };
  fn.calls = calls;
  return fn;
}

test('mintJWT produces a valid RS256 token verifiable with the public key', () => {
  const jwt = mintJWT({ appId: 12345, privateKeyPem: PRIVATE_KEY });
  const parts = jwt.split('.');
  assert.equal(parts.length, 3);
  // Decode header + payload.
  const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  assert.equal(header.alg, 'RS256');
  assert.equal(payload.iss, '12345');
  assert.ok(payload.exp - payload.iat <= 10 * 60);
  // Verify signature.
  const pubKey = crypto.createPrivateKey(PRIVATE_KEY).export({ type: 'pkcs1', format: 'pem' });
  // Re-derive public key via crypto.createPublicKey.
  const publicKey = crypto.createPublicKey(PRIVATE_KEY);
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const sig = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  assert.ok(verifier.verify(publicKey, sig));
  assert.ok(pubKey.length > 0);
});

test('open_pr exchanges JWT for installation token and creates PR', async () => {
  const fetch = mockFetch([
    jsonResponse(201, { token: 'ghs_inst_abc', expires_at: '2026-01-01T00:00:00Z' }),
    jsonResponse(201, { number: 42, html_url: 'https://github.com/org/repo/pull/42' }),
  ]);
  const out = await open_pr({
    fetch,
    appId: 99,
    privateKeyPath: KEY_PATH,
    installationId: 7,
    owner: 'org',
    repo: 'repo',
    title: 'fix bug',
    body: 'details',
    head: 'feature',
    base: 'main',
  });
  assert.equal(out.number, 42);
  assert.equal(out.url, 'https://github.com/org/repo/pull/42');
  // First call: installation token endpoint with Bearer JWT.
  assert.equal(fetch.calls[0].url, 'https://api.github.com/app/installations/7/access_tokens');
  assert.match(fetch.calls[0].opts.headers.Authorization, /^Bearer /);
  // Second call: pulls endpoint with token <inst>.
  assert.equal(fetch.calls[1].url, 'https://api.github.com/repos/org/repo/pulls');
  assert.equal(fetch.calls[1].opts.headers.Authorization, 'token ghs_inst_abc');
  const sentBody = JSON.parse(fetch.calls[1].opts.body);
  assert.equal(sentBody.title, 'fix bug');
  assert.equal(sentBody.head, 'feature');
  assert.equal(sentBody.base, 'main');
});

test('open_pr surfaces installation token errors', async () => {
  const fetch = mockFetch([
    { ok: false, status: 401, text: async () => 'unauthorized', json: async () => ({}) },
  ]);
  await assert.rejects(
    () => open_pr({
      fetch, appId: 1, privateKeyPath: KEY_PATH, installationId: 1,
      owner: 'o', repo: 'r', title: 't', head: 'h', base: 'b',
    }),
    /installation token failed/,
  );
});

test('open_pr surfaces PR creation errors', async () => {
  const fetch = mockFetch([
    jsonResponse(201, { token: 'ghs_x' }),
    { ok: false, status: 422, text: async () => 'invalid', json: async () => ({}) },
  ]);
  await assert.rejects(
    () => open_pr({
      fetch, appId: 1, privateKeyPath: KEY_PATH, installationId: 1,
      owner: 'o', repo: 'r', title: 't', head: 'h', base: 'b',
    }),
    /pull request creation failed/,
  );
});

test('open_pr requires appId, installationId, owner/repo, title/head/base', async () => {
  const fetch = mockFetch([]);
  await assert.rejects(() => open_pr({ fetch }), /appId is required/);
  await assert.rejects(
    () => open_pr({ fetch, appId: 1 }),
    /installationId is required/,
  );
  await assert.rejects(
    () => open_pr({ fetch, appId: 1, installationId: 1 }),
    /owner and repo are required/,
  );
  await assert.rejects(
    () => open_pr({
      fetch, appId: 1, installationId: 1, owner: 'o', repo: 'r',
    }),
    /title, head, base are required/,
  );
});

test('OpenPRTool constructor errors when no fetch available', () => {
  // Force missing fetch.
  assert.throws(() => new OpenPRTool({ fetch: null }), /no fetch available/);
});
