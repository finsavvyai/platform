# Archive

Deprecated reference implementations preserved for historical
context. Nothing in here is wired into the running app — these
files exist so a future engineer can see what the placeholder
looked like before it got replaced by the real backend.

## ai_proxy.py — superseded 2026-05-03

Original placeholder FastAPI sidecar that exposed
`POST /summarize`. Replaced by the production aegis backend
endpoint `POST /api/v1/ai/summarize` which runs the same three
prompt templates (alert / adverse_media / case) but adds:

- JWT auth via the standard aegis authChain
- DLP scrub: SanitizeName + MaskAML (PII + PAN + IBAN + BIC + Israeli ID)
- Tamper-evident audit log via `AuditActionAISummarized`
- AWS Bedrock backend option for data-residency pilots
- Fail-closed behaviour: a missing audit repo returns 500, not silent success

The frontend in `src/api/ai.ts` already targets the production
contract. Aegis commits:

- `dbbb060` feat(api): POST /api/v1/ai/summarize for AML alert/case/media
- `ddf09a2` feat(security): fintech DLP — PAN, IBAN, BIC, Israeli ID redactors
- `c01aaa1` feat(ai): AWS Bedrock provider with hand-rolled SigV4

Do not run `ai_proxy.py` against production traffic. It bypasses
auth, audit, and DLP — it was a 2-day placeholder, never a product.
