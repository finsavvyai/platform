# Template 06 — Product Hunt Launch Copy

**Status:** Draft for manual launch. Do not automate.

---

## Sender notes

- **Launch day:** Tuesday or Wednesday, 12:01 AM Pacific. Avoid Mondays (overcrowded) and Fridays (dead audience). Set `{launch_date}` once decided.
- **Hunter:** ideally a Product Hunt account with track record. If launching as the maker yourself, that's fine — Product Hunt removed the hunter-favoritism dynamic.
- **Gallery assets:** 1280×800 PNGs. First image is the gallery cover and matters most. Show the product UI, not stock photos. No fake screenshots.
- **First comment:** post within 5 minutes of going live. This is non-negotiable on PH.
- **Engage all day.** Reply to every comment, including critical ones. Do not delete negative comments — respond to them.
- **Do not** buy upvotes. Do not run "upvote my product" Slack/Discord blasts. PH detects this and penalizes the listing.

---

## Title (60 chars max)

`sdlc.cc — Self-hosted AI gateway for regulated teams`

## Tagline (60 chars max)

`Run RAG and LLMs inside your own cloud. Built for law firms.`

---

## Description (260 chars, PH's limit)

Open-source RAG, LLM routing, and DLP that runs inside your VPC. Privileged data never leaves your tenancy. Postgres RLS for per-matter isolation, audit logs that map to ABA Op. 512 and Rule 1.6(c). AGPL-3.0, commercial license available.

---

## Topics (pick 3, PH's limit)

- Developer Tools
- Artificial Intelligence
- Legal

---

## Gallery captions

1. **Cover (1280×800):** Architecture overview — Gateway → RAG → LLM Gateway → DLP, with the boundary line labeled "Your tenancy." Caption: "Everything inside the dashed line runs on your infra. Nothing crosses it."
2. **Audit log screen:** Per-request log showing user, matter ID, prompt hash, retrieved chunks, model, and policy decisions. Caption: "Every prompt is logged. Every policy decision is logged. Reasonable efforts, documented."
3. **DLP redaction:** Side-by-side of raw document and post-DLP version. Caption: "PII, PHI, and matter numbers redacted before any vector store or LLM call."
4. **Postgres RLS policy:** Code snippet of a tenant-scoped RLS policy and the matching query plan. Caption: "Multi-tenant isolation at the database row level. Not bolted on at the app layer."
5. **Deployment options:** Three columns — AWS VPC, Azure, on-prem K8s. Caption: "Deploy where your data already lives."

---

## First comment template

Hey Product Hunt — Shahar here, founder of sdlc.cc.

Quick context on why this exists: ABA Formal Opinion 512 made it clear in July 2024 that attorney competence and confidentiality obligations extend to GenAI tools. Most AI vendors process data on vendor infrastructure. For firms doing M&A, litigation, or regulated-industry work, that's a hard procurement problem.

sdlc.cc runs entirely inside your cloud tenancy. The architecture, briefly:

- **Gateway** (Go) — auth, tenant context, OPA policies, audit log
- **RAG** (Python + pgvector) — chunk, embed, retrieve with Postgres RLS
- **LLM Gateway** — pluggable providers including local Llama via vLLM
- **DLP** — redact PII / PHI / matter numbers pre-embedding

The license is AGPL-3.0 so your security team can audit every line. There's a commercial license for firms that prefer not to publish modifications — that's how I keep the project sustainable.

A few honest notes for PH:

- This is an early-stage project. The repo is real, but I'm not going to claim a customer list I don't have.
- I'd genuinely value technical feedback. Especially from anyone who's built multi-tenant infra or deployed AI in regulated environments.
- I'm here all day. Ask me anything — including the hard questions about cost, maintenance burden, and whether self-hosting actually makes sense for your team.

Repo and docs in the link. Happy launch day, everyone.

---

## What to swap

- `{launch_date}` once decided
- Maker / founder name (currently Shahar Solomon)
- Gallery screenshots — must be real product UI, not mockups
- Confirm AGPL-3.0 is the actual license in the repo before posting
