# Deployment

## Recommended Production Topology

Public edge:
- Cloudflare Pages for UIs
- Cloudflare Workers for public API ingress
- Cloudflare R2 for artifacts and large log blobs
- Cloudflare Durable Objects for live event fan-out

Runtime core:
- Render web service for `agent-core` if Cloudflare Workers call it directly
- optional Render private services behind `agent-core` for deeper internal split
- Render Postgres for agent session metadata if persistence is needed
- Render Key Value for leases, queues, and transient state
- Render background worker for async compaction or long-running tool jobs

## Why Not Put Agent Core Directly on Workers

- the shared runtime is long-lived and stateful
- product toolpacks may need private networking
- richer filesystem/process semantics belong in a private service
- Cloudflare is the correct public edge and streaming layer, not the main home of the core runtime

## Important Connectivity Constraint

Cloudflare Workers cannot reach Render private services over Render's private network.

That means:
- if the Worker is the caller, expose `agent-core` as a public Render web service and protect it
- if you want fully private Render networking, put a Render-hosted API in front of `agent-core` and let Cloudflare call that public ingress

## Deployment Phases

### Phase 1

- run `agent-core` locally
- point PushCI to `http://127.0.0.1:8088`

### Phase 2

- containerize `agent-core`
- deploy to Render private service
- update PushCI env vars to private Render URL

### Phase 3

- add Redis-backed queue and durable persistence if session retention becomes necessary
- add second tenant, likely OpenSyber
