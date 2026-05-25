# SDLC Platform — Live Test Guide

**Production URLs:**
- Landing: https://sdlc.cc
- API:     https://api.sdlc.cc
- Pages preview: https://sdlc-landing-page.pages.dev

**Stack deployed (Cloudflare):**

| Component | Where | Status |
|---|---|---|
| `landing-page` (Next.js 15) | Cloudflare Pages → `sdlc.cc` + `www.sdlc.cc` | live |
| `proxy-worker` | Cloudflare Workers → `api.sdlc.cc/*` | live |
| `landing-worker` | deleted (Pages owns the apex now) | n/a |
| `gateway` (Go) | K8s/Docker — not on Cloudflare yet | pending |
| `rag` (Python) | K8s/Docker — not on Cloudflare yet | pending |
| `vector-core` (Rust) | not deployed | pending |

## 1) Smoke

```bash
curl -sI https://sdlc.cc | head -3      # 200
curl -s  https://api.sdlc.cc/health     # {"status":"ok",...}
```

Open https://sdlc.cc — renders the marketing page.

## 2) Issue a tenant API key

```bash
KEY="sk-sdlc-$(openssl rand -hex 16)"
RECORD=$(jq -n --arg id "key_$(date +%s)" --arg user "your-user-id" \
  '{id:$id, user_id:$user, status:"active", created_at:(now | todate)}')
echo "$RECORD" | npx wrangler kv key put "$KEY" \
  --binding API_KEYS --remote --cwd services/proxy-worker
echo "Your SDLC key: $KEY"
```

## 3) Wire upstream LLM keys (one-time, per CF account)

```bash
cd services/proxy-worker
echo "sk-proj-YOUR-OPENAI-KEY"  | npx wrangler secret put OPENAI_API_KEY
echo "sk-ant-YOUR-ANTHROPIC-KEY" | npx wrangler secret put ANTHROPIC_API_KEY
```

The currently-deployed OpenAI key is rejected upstream (test key from
the alpha cohort) — rotate before any real traffic.

## 4) Test with curl

```bash
curl -X POST https://api.sdlc.cc/v1/chat/completions \
  -H "Authorization: Bearer $YOUR_SDLC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":50}'
```

## 5) Use from Claude Code

```bash
export ANTHROPIC_BASE_URL=https://api.sdlc.cc/anthropic
export ANTHROPIC_API_KEY=$YOUR_SDLC_KEY
claude code     # every prompt now flows through SDLC
```

## 6) Roll out to a team

1. Each dev installs the env vars (chezmoi / 1Password Shell / direnv).
2. Issue per-user SDLC keys (script in §2) — one per dev so audit logs
   attribute correctly.
3. Optional: SCIM-provision via `/scim/v2/Users` on the gateway (Okta /
   Azure AD / JumpCloud — guides land in `docs/sso/` next session).

## 7) Monitoring

- Workers: Cloudflare dashboard → Workers & Pages → `sdlc-proxy` → Logs
  (live tail) + Analytics.
- Pages: same dashboard → `sdlc-landing-page` → Web Analytics.
- Audit log stream: `sdlc:events:{tenant_id}` Redis channel → realtime
  worker → R2 sink.

## Known gaps before full enterprise rollout

- Gateway (Go, full feature set) not on Cloudflare. Worker proxy only
  validates keys + forwards. SCIM/SSO/DLP/policy live in the K8s gateway.
- OpenAI upstream key needs rotation (see §3).
- Tenant onboarding is manual until the admin UI is wired to a public
  signup flow.
- DLP runs server-side (gateway), not at the edge.
