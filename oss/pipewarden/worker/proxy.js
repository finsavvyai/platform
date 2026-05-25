// PipeWarden Worker proxy — routes traffic to the Cloudflare Container
// running the Go HTTP server on port 8080.
//
// Architecture: Worker -> Durable Object -> Container -> Go server
// Docs: https://developers.cloudflare.com/containers/get-started/
//
// Secrets are forwarded into the container via envVarsFor(env). The
// Go binary refuses to start unless required keys (vault, session,
// SMTP, WebAuthn, database URL) are present — see internal/config/validate.go.

import { Container, getRandom } from "@cloudflare/containers";

// envVarsFor maps Worker-bound vars/secrets to container env vars.
// Undefined entries are stripped so the container only sees real values.
function envVarsFor(env) {
  const out = {
    PIPEWARDEN_ENVIRONMENT:     env.PIPEWARDEN_ENVIRONMENT     ?? "production",
    PIPEWARDEN_SERVER_PORT:     env.PIPEWARDEN_SERVER_PORT     ?? "8080",
    PIPEWARDEN_DATABASE_DRIVER: env.PIPEWARDEN_DATABASE_DRIVER ?? "postgres",
    PIPEWARDEN_LOGGING_LEVEL:   env.PIPEWARDEN_LOGGING_LEVEL   ?? "info",
    PIPEWARDEN_HOSTED_MODE:     env.PIPEWARDEN_HOSTED_MODE     ?? "true",
    PIPEWARDEN_COOKIE_DOMAIN:   env.PIPEWARDEN_COOKIE_DOMAIN,
    PIPEWARDEN_WEBAUTHN_NAME:   env.PIPEWARDEN_WEBAUTHN_NAME,
  };
  const secrets = [
    "PIPEWARDEN_VAULT_KEY",
    "PIPEWARDEN_SESSION_SECRET",
    "PIPEWARDEN_DATABASE_URL",
    "PIPEWARDEN_SMTP_HOST",
    "PIPEWARDEN_SMTP_PORT",
    "PIPEWARDEN_SMTP_USER",
    "PIPEWARDEN_SMTP_PASSWORD",
    "PIPEWARDEN_SMTP_FROM",
    "PIPEWARDEN_WEBAUTHN_RPID",
    "PIPEWARDEN_WEBAUTHN_ORIGINS",
    "CLAUDE_API_KEY",
    "ANTHROPIC_API_KEY",
    "GITHUB_APP_ID",
    "GITHUB_APP_SLUG",
    "GITHUB_PRIVATE_KEY",
    "GITHUB_PRIVATE_KEY_PATH",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_WEBHOOK_SECRET",
    "GITHUB_API_BASE_URL",
    "GITLAB_WEBHOOK_SECRET",
    "LEMONSQUEEZY_API_KEY",
    "LEMONSQUEEZY_STORE_ID",
    "LEMONSQUEEZY_WEBHOOK_SECRET",
    "CLAW_API_KEY",
    "CLAW_PROJECT_ID",
    "PIPEWARDEN_AUDIT_ENDPOINT",
    "PIPEWARDEN_AUDIT_TOKEN",
    "SLACK_WEBHOOK_URL",
    "PAGERDUTY_INTEGRATION_KEY",
    "JIRA_BASE_URL",
    "JIRA_EMAIL",
    "JIRA_API_TOKEN",
    "JIRA_PROJECT_KEY",
  ];
  for (const k of secrets) {
    if (env[k] !== undefined) out[k] = env[k];
  }
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

export class PipeWardenContainer extends Container {
  defaultPort = 8080;
  sleepAfter  = "10m";

  // The Container SDK reads `this.envVars` as a plain field at start time
  // (see node_modules/@cloudflare/containers/dist/lib/container.js:1280).
  // A getter on the subclass DOES NOT override a parent's field write —
  // assign in the constructor instead so secrets from `wrangler secret
  // put` actually reach the Go binary.
  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = envVarsFor(env);
  }
}

export default {
  async fetch(request, env) {
    // getRandom returns a Promise<DurableObjectStub> in @cloudflare/containers
    // >=0.3 — must await before .fetch().
    const instance = await getRandom(env.PIPEWARDEN_CONTAINER, 3);
    return instance.fetch(request);
  },
};
