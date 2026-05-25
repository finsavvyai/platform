# Template 05 — Hacker News "Show HN" Post

**Status:** Draft for manual posting. Do not automate.

---

## Sender notes

- **Read the Show HN guidelines first:** https://news.ycombinator.com/showhn.html — the rules are short and strict.
- **Post Tuesday–Thursday, 8–10 AM Pacific.** That's when HN traffic peaks for technical audiences. Avoid Mondays (catch-up) and Fridays (dead).
- **Do not** ask friends to upvote. HN detects vote rings and will bury the post or ban the account.
- **Do not** edit the title after submission to add hype. The title field is the title field.
- **Be present in comments for the first 4 hours.** Answer technical questions, acknowledge mistakes, do not get defensive. The comments are where you win or lose HN.
- **Expected outcome:** front page is a lottery. A solid Show HN that doesn't reach front page still earns 50–500 quality engineers reading the repo. That's the real win.

---

## Title (≤80 chars, HN's limit)

`Show HN: Self-hosted RAG and LLM gateway for law firms (AGPL-3.0, Go + Python)`

---

## URL field

`https://github.com/{org}/sdlc-platform` (or the canonical landing page, if it's more informative)

---

## Text field (optional — HN allows a short body if URL isn't enough)

We're building sdlc.cc, an open-source RAG and LLM gateway designed to run inside a single tenancy. The target user is a law firm or any regulated team that can't send privileged content to a third-party AI vendor.

The architecture, briefly:

- **Gateway** (Go 1.24, Chi router, OpenAPI 3) — auth, tenant context, rate limiting, audit logging, OPA policies in the middleware chain.
- **RAG service** (Python 3.11, FastAPI, pgvector) — chunk + embed + retrieve, with per-matter access controls enforced at the row level via Postgres RLS.
- **LLM gateway** — pluggable providers (OpenAI, Anthropic, local Llama via vLLM), per-tenant rate and cost tracking, fallback routing.
- **DLP** — PII / PHI / matter-number redaction before any vector store or LLM call.

License is AGPL-3.0. There's a commercial license available for firms that don't want to publish modifications — that's how the project is sustained.

Why post it here: the hardest design problems aren't the AI parts, they're the boring ones — tenant isolation, audit log integrity, key rotation, RLS edge cases, how to make "self-hosted" actually deployable by a firm with three IT people. I'd value feedback from anyone who's built multi-tenant infra at scale, and especially from anyone who's deployed AI inside a regulated environment.

Repo, architecture docs, and a one-command Docker Compose for local trial are in the link. Happy to answer anything in the thread.

— Shahar

---

## What to swap

- Org name in the GitHub URL
- Nothing else. Do not add emoji. Do not add "🚀". Do not write "excited to share."
- If the project is not yet public on GitHub, do not post Show HN. Make the repo real first.
