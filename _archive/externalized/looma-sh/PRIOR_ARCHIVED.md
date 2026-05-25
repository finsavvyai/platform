# looma-sh — Archived

**Snapshot date:** 2026-05-25
**Snapshot type:** manifest-only (source >100MB)
**Disposition:** off-thesis

## Source
- **Path:** `/Users/shaharsolomon/dev/projects/portfolio/looma-sh/`
- **Commit SHA:** n/a (not a git repo)
- **Last commit:** n/a
- **Size on disk:** 2.3G
- **File count:** 123,410

## README excerpt
```
# Looma.sh

A developer-first, edge-deployed Vehicle-to-Vehicle (V2V) messaging API.
Sign up, mint an API key, and send signed messages between vehicles in
under a minute. Built on Cloudflare Workers, Durable Objects, and D1.

Status (2026-05-08): Phase 1 (auth + persistence) shipped to production.
Signup → lk_ API key flow live at relay.looma.sh. Replay protection
(Phase 4) and full SDK (Phase 7) pending.

Live: https://looma.sh (marketing), https://relay.looma.sh (API).
```

## Reason for archiving (per addendum §3)
"V2V messaging API — interesting but off-thesis."

## Overlap assessment
Architecturally interesting (Cloudflare Workers + DO + D1 — same stack as
ai-gateway), but **product overlap zero**. The auth/key-minting pattern
is well-implemented; if anyone needs a Workers signup-to-API-key
reference, this is good prior art.

**Note for PUSHCI / ai-gateway agents:** if you need an example of
production-grade Workers auth with KV-backed API keys, take a look at
this repo's `app/.planning/ROADMAP.md` and signup handler before delete.

## Suggested final disposition
**Preserve 60 days, then delete.** Live in production at last check —
verify the relay.looma.sh service is actually shut down before deletion.
