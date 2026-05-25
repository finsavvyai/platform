// open_pr — REAL GitHub App auth + PR creation.
//
// Flow:
//   1. Mint a JWT (RS256) signed with the App private key (iss=appId, exp<=10m).
//   2. POST /app/installations/{installationId}/access_tokens to get
//      a short-lived installation token.
//   3. POST /repos/{owner}/{repo}/pulls with that token to open the PR.
//
// Returns { url, number }.
//
// Tests inject a `fetch` function via the constructor; production uses
// node 22's global fetch.

const crypto = require('node:crypto');
const fs = require('node:fs');

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function mintJWT({ appId, privateKeyPem, now = Date.now() }) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const iat = Math.floor(now / 1000) - 30;
  const exp = iat + 9 * 60; // 9 min, well under the 10m max
  const payload = { iat, exp, iss: String(appId) };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const sig = signer.sign(privateKeyPem);
  return `${signingInput}.${b64url(sig)}`;
}

class OpenPRTool {
  constructor({ fetch: fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
    if (!fetchImpl) {
      throw new Error('open_pr: no fetch available; pass one via constructor');
    }
    this.fetch = fetchImpl;
    this.now = now;
  }

  async run({ appId, privateKeyPath, privateKeyPem, installationId, owner, repo, title, body, head, base }) {
    if (!appId) throw new TypeError('open_pr: appId is required');
    if (!installationId) throw new TypeError('open_pr: installationId is required');
    if (!owner || !repo) throw new TypeError('open_pr: owner and repo are required');
    if (!title || !head || !base) throw new TypeError('open_pr: title, head, base are required');

    const pem = privateKeyPem || (privateKeyPath ? fs.readFileSync(privateKeyPath, 'utf8') : null);
    if (!pem) throw new TypeError('open_pr: privateKeyPath or privateKeyPem is required');

    const jwt = mintJWT({ appId, privateKeyPem: pem, now: this.now() });

    // 1. Exchange JWT for installation token.
    const tokenResp = await this.fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      throw new Error(`open_pr: installation token failed: ${tokenResp.status} ${text}`);
    }
    const tokenJson = await tokenResp.json();
    const instToken = tokenJson.token;
    if (!instToken) throw new Error('open_pr: installation token missing in response');

    // 2. Create the PR.
    const prResp = await this.fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${instToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ title, body: body || '', head, base }),
      },
    );
    if (!prResp.ok) {
      const text = await prResp.text();
      throw new Error(`open_pr: pull request creation failed: ${prResp.status} ${text}`);
    }
    const pr = await prResp.json();
    return { url: pr.html_url || pr.url, number: pr.number };
  }
}

function open_pr(opts = {}) {
  const tool = new OpenPRTool({ fetch: opts.fetch, now: opts.now });
  return tool.run(opts);
}

module.exports = open_pr;
module.exports.OpenPRTool = OpenPRTool;
module.exports.mintJWT = mintJWT;
