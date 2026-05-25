# Tailscale dev-mesh — staging private network

Status: dev-only. **Not** a production substitute for Sprint 3 AWS PrivateLink (BEAT-PLAN S3.3). Use this to demo "private-network mode" while the Terraform module lands.

## Why

The AWS PrivateLink Terraform module (S3.3) is sized at ~8 person-days. Until it ships, we still want a credible answer to enterprise buyers asking "can the gateway and document-processor talk over a private network?". Tailscale gives a working answer in 30 minutes that the gateway and doc-processor literally use over WireGuard, not over `localhost`.

## Prerequisites

- A Tailscale account (free tier covers up to 100 devices). Create at https://login.tailscale.com.
- Auth keys at https://login.tailscale.com/admin/settings/keys. Create one **reusable** + **ephemeral** key tagged `tag:sdlc-dev` so dev VMs auto-deregister when they shut down.
- Tag policy in your Tailscale admin ACL:
  ```
  "tagOwners": { "tag:sdlc-dev": ["group:engineering"] }
  ```

## One-time bootstrap per dev box

```bash
# macOS
brew install --cask tailscale && open /Applications/Tailscale.app
# Linux
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --authkey="$TS_DEV_KEY" --advertise-tags=tag:sdlc-dev
tailscale status
```

`tailscale status` should list `<your-host>` with a `100.x.y.z` IPv4.

## Wire gateway → doc-processor over the tailnet

1. Bring up the doc-processor on a second machine inside the tailnet (or a Linux VM):
   ```bash
   sudo tailscale up --authkey="$TS_DEV_KEY" --advertise-tags=tag:sdlc-dev
   cd services/document-processor && npm start
   ```
2. From the gateway dev box, point the doc-processor URL at the tailnet hostname:
   ```bash
   export DOCUMENT_PROCESSOR_URL=http://docproc-dev:3000
   cd services/gateway && go run ./cmd/server
   ```
3. Smoke:
   ```bash
   curl -s "http://docproc-dev:3000/health" | jq .
   ```
   The traffic flows over WireGuard. `tcpdump` on the host's public interface shows nothing on port 3000.

## Optional: bind compose Postgres to the tailnet only

`make-it-run.sh` shifted the host Postgres mapping to `5433:5432` (see `.config/docker/docker-compose.dev.yml`). To remove host exposure entirely and force traffic over the tailnet:

```yaml
postgres:
  image: pgvector/pgvector:pg15
  ports: []   # remove "5433:5432"
  network_mode: "host"
```

Then on the host:

```bash
sudo tailscale serve --bg --tcp=5432 tcp://localhost:5432
```

`tailscale status` will show the published service. Other tailnet members reach Postgres at `<host>:5432` *only* when authenticated to the tailnet.

## Demo script

The five-minute walkthrough for design-partner calls:

1. Show `tailscale status` listing two devices.
2. `curl http://docproc-dev:3000/health` — works.
3. Drop Tailscale (`sudo tailscale down`) — same curl now hangs / refuses.
4. Bring it back up — works again.

## What this does NOT replace

- **AWS PrivateLink** (BEAT-PLAN S3.3) — customer-controlled VPC endpoints, not a third-party SaaS network. Tailscale is a developer convenience; PrivateLink is the customer-procurement answer.
- **SOC 2 evidence** — Tailscale's logs aren't part of our audit-log chain. The HMAC `audit_logs` table (Day 12) is the SOC 2 source of truth.
- **mTLS** — the gateway's mTLS rotation work (Day 37, INTEGRATION-DEBT 🟡) is independent. Tailscale gives WireGuard, not certificate-based service identity.

## Cleanup

```bash
sudo tailscale logout
sudo tailscale down
# In the admin UI: revoke the reusable key.
```

## Reference

- Tailscale docs: https://tailscale.com/kb
- ACL tags: https://tailscale.com/kb/1068/acl-tags
- BEAT-PLAN row this stands in for: `docs/roadmap/BEAT-PLAN.md` S3.3.
