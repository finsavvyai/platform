# Self-Hosting sdlc.cc Gateway

Last updated: 2026-05-04

This is the FI/regulated-shop guide to running aegis (the Go binary
behind sdlc.cc) inside your own infrastructure. The wedge over
Portkey/LiteLLM here is "no AWS lock-in, no vendor cloud required,
ships with fintech DLP." If you don't need self-host, the SaaS at
`https://api.sdlc.cc` works the same way.

## Three deployment shapes

| Shape | Where it runs | LLM backend | Use case |
|---|---|---|---|
| **SaaS** | sdlc.cc-hosted | Anthropic via our key | Fast pilot, no infra work |
| **VPC self-host** | Your AWS/GCP/Azure VPC | Anthropic via your key | "Prompts leave only OUR network" |
| **Air-gapped** | On-prem, no internet | Local Ollama (Gemma) | Classified / fully isolated |

All three use the **same `bin/sdlc-api` binary** — config switches
the topology, no separate fork.

## Prereqs (any shape)

- Postgres 14+ with the `aegis` database created
- One of: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`,
  `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, OR a
  reachable Ollama instance (`OLLAMA_HOST`)
- For SAML SSO: `AEGIS_SSO_BASE_URL` set to your public host

You do NOT need:
- AWS account
- Bedrock subscription
- A specific cloud provider

## Shape 1 — SaaS (zero work for you)

Point your Claude Code / Cowork / SDK at `https://api.sdlc.cc`.
Sign up, create a tenant, configure SSO via the dashboard. We host
the binary, the DB, and the inference relay. You bring your own
Anthropic key (or use ours metered).

## Shape 2 — VPC self-host

Goal: prompts only leave your VPC over your egress to Anthropic.
We never see them.

The Docker image is published to GHCR by `.github/workflows/docker-sdlc.yml`
on every push to main. First-time setup requires the GHCR package
to be public OR your customer's GH org needs read access to the
package. Default: public.

```bash
# 1. Pull the Docker image
docker pull ghcr.io/finsavvyai/aegis-sdlc-api:latest

# 2. Set env (your Postgres, your Anthropic key, your domain)
export DATABASE_URL=postgres://user:pass@your-pg:5432/aegis
export ANTHROPIC_API_KEY=sk-ant-...
export AEGIS_SSO_BASE_URL=https://gateway.yourbank.example.com
export AEGIS_AI_DAILY_CAP=10000
export PORT=8080

# 3. Run (auto-applies migrations on boot)
docker run -p 8080:8080 \
  -e DATABASE_URL -e ANTHROPIC_API_KEY \
  -e AEGIS_SSO_BASE_URL -e AEGIS_AI_DAILY_CAP -e PORT \
  ghcr.io/finsavvyai/aegis-sdlc-api:latest

# 4. Verify
curl https://gateway.yourbank.example.com/health
```

What's running:
- Auto-applied schema migrations (070 + 071 + everything else)
- Multi-provider chain: Anthropic primary, optional Gemma fallback
- Full DLP pipeline (PAN, IBAN, BIC, Israeli ID, email, phone)
- Per-tenant SAML SSO with role mapping
- Per-tenant + per-seat AI quota
- Request observability (24h sliding window, in-memory)

What you still need to do:
- Provision an SAML row per onboarded tenant via `bin/aegis-saml-keygen | psql`
- Configure your IdP to trust the SP entity ID we hand back
- Point clients at `https://gateway.yourbank.example.com/v1/messages`

## Shape 3 — Air-gapped (no internet)

For classified / isolated environments where prompts cannot reach
Anthropic at all. Uses local Gemma via Ollama as the only backend.

```bash
# 1. Pull both Docker images while you have internet
docker pull ghcr.io/finsavvyai/aegis-sdlc-api:latest
docker pull ollama/ollama:latest

# 2. Save and transfer to the air-gapped network
docker save aegis-sdlc-api ollama/ollama | gzip > aegis-bundle.tar.gz

# 3. On the isolated network, load + run Ollama with a Gemma model
docker load < aegis-bundle.tar.gz
docker run -d -p 11434:11434 --gpus all -v ollama:/root/.ollama \
  --name ollama ollama/ollama
docker exec ollama ollama pull gemma2:9b

# 4. Run aegis pointing at local Ollama
export DATABASE_URL=postgres://...
export OLLAMA_HOST=http://ollama:11434
export GEMMA_MODEL=gemma2:9b
# Note: NO ANTHROPIC_API_KEY — air-gapped
docker run -p 8080:8080 \
  -e DATABASE_URL -e OLLAMA_HOST -e GEMMA_MODEL \
  ghcr.io/finsavvyai/aegis-sdlc-api:latest
```

The fallback chain auto-detects: with `ANTHROPIC_API_KEY` unset, it
filters that link and uses GemmaAdapter (which routes to Ollama
when no cloud key is present). Same DLP + audit + SAML pipeline.

Trade-off: Gemma 9B local quality < Claude Haiku quality. For pure
"summarize this AML alert in 3 bullets" workloads this is fine. For
agent / tool-use flows you'd need a bigger local model (Llama 70B
class) or multi-GPU.

## What FI customers ask in security review

| Question | Answer |
|---|---|
| Where does the prompt go? | Your VPC's egress to Anthropic (Shape 2) or nowhere (Shape 3) |
| Where is the prompt stored? | Postgres `ai_request_log` table in your DB |
| Are PANs/IBANs scrubbed? | Yes — `MaskAML` runs before any provider call |
| Can the gateway be bypassed? | Only if you don't enforce egress firewall rules — that's IT's job |
| Is the audit log tamper-evident? | Yes — migration 069 hash chain |
| Which CVEs do you depend on? | `go list -m all` output + monthly dependabot |
| What's your SLA? | SaaS: 99.5%. Self-host: yours to operate |

## Config reference

See [AI_GATEWAY_ENV.md](./AI_GATEWAY_ENV.md) for every env var the
binary respects, including the multi-provider env-detection priority
order, quota caps, cache TTL, and SSO base URL.

## Open questions documented

- **Anthropic Cowork BASE_URL support**: Verified for Claude Code
  (uses `ANTHROPIC_BASE_URL`). Not yet verified for Cowork — we
  recommend customers test with their Anthropic SE and tell us. If
  Cowork doesn't support custom base URL, the only enforcement is
  firewall-block + Code/SDK substitution.
- **SSE streaming through the gateway**: Currently 400-rejects
  `stream:true`. Roadmap. Tracking in PHASE_E commit when shipped.
- **Multi-replica AI quota**: In-memory counter undercounts at
  scale. Redis swap is local change in `middleware_ai_quota.go`.
