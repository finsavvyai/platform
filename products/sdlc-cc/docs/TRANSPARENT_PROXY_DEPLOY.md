# Transparent Proxy Deploy — sdlc.cc as api.anthropic.com on your network

This is the deployment shape that catches **every Anthropic client**
on a corporate network — Cowork, Claude Code, Claude Desktop, the
Anthropic SDK, browser extensions, even claude.ai web. No client-
side configuration. No MDM env-var rollout. One DNS record.

## What you get

```
Bank's analyst opens Cowork                         Bank's network
       │                                    ┌────────────────────┐
       │ "summarize this customer file"     │  Corp DNS server   │
       ▼                                    │  api.anthropic.com │
   Cowork client                            │   → 10.0.0.50      │
       │                                    └────────────────────┘
       │ HTTPS to api.anthropic.com                    │
       │                                               │
       └───────────────────────────────────────────────▶
                                                       │
                                       ┌───────────────▼──────────┐
                                       │ sdlc.cc gateway          │
                                       │ - TLS cert: api.anthropic │
                                       │   .com signed by your    │
                                       │   internal CA            │
                                       │ - DLP scrub the prompt   │
                                       │   (PAN, IBAN, BIC, IL ID)│
                                       │ - Audit row written      │
                                       │ - Forward to real        │
                                       │   api.anthropic.com over │
                                       │   outbound egress        │
                                       └────────────┬─────────────┘
                                                    │
                                                    ▼
                                       Real api.anthropic.com
                                       (DLP'd prompt; same response
                                        flows back through us)
```

## Why this beats `ANTHROPIC_BASE_URL`-based config

`ANTHROPIC_BASE_URL` works only for clients that respect it (Claude
Code, the SDK). Cowork, Claude Desktop, and the web app may not.
Transparent-proxy mode catches them ALL because it operates at the
DNS + TLS layer, not the application layer.

## Three IT actions (one-time setup, ~1 hour for an experienced ops engineer)

### 1. Internal CA certificate

You almost certainly already have this — banks use internal CAs to
sign internal service certs (BlueCoat, Zscaler, etc. work the same
way). MDM pushes the CA root to every managed device's trust store.

Mint a leaf cert for `api.anthropic.com` signed by your internal CA:

```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout sdlc.key -out sdlc.csr \
  -subj "/CN=api.anthropic.com" \
  -addext "subjectAltName=DNS:api.anthropic.com"

# Sign with your internal CA (your existing process)
# Result: sdlc.crt + sdlc.key
```

### 2. Deploy sdlc.cc gateway

```bash
docker run -d -p 443:443 \
  -e PORT=443 \
  -e TRANSPARENT_PROXY_HOSTS=api.anthropic.com \
  -e ANTHROPIC_API_KEY=sk-ant-your-real-key \
  -v /path/to/certs:/certs:ro \
  --name sdlc-cc \
  ghcr.io/finsavvyai/sdlc-cc:latest \
  ./sdlc-api --tls-cert /certs/sdlc.crt --tls-key /certs/sdlc.key
```

(TLS-cert flag wiring is roadmap; today the binary listens HTTP.
For production transparent-proxy, run behind a TLS terminator —
nginx, envoy, traefik, or AWS ALB with the corp cert.)

### 3. Corporate DNS

In your AD-DNS / Bind / Route53 / wherever, add:

```
api.anthropic.com.   IN   A   10.0.0.50
```

(Replace `10.0.0.50` with the gateway's reachable internal IP.)

That's it. Every Anthropic client on your network will now hit your
gateway. The gateway has the corp-signed cert; clients trust it
(corp CA root is installed via MDM); they don't notice the proxy.

## What happens per request type

| Request | Path | Behavior |
|---|---|---|
| Cowork agent screening alert | `POST /v1/messages` | Intercept → DLP scrub → audit → forward to real Anthropic |
| Claude Code asks about IBAN code | `POST /v1/messages` | Same — DLP catches the IBAN |
| Cowork lists available models | `GET /v1/models` | Pass-through unchanged |
| SDK estimates tokens | `POST /v1/messages/count_tokens` | Pass-through unchanged |
| Future Anthropic endpoint | (anything else) | Pass-through unchanged |

We default to **pass-through** for endpoints we haven't audited.
This means new Anthropic features keep working; we add interception
only when there's a known DLP-relevant payload shape.

## Tenant identification when there's no JWT

The Cowork / Code / Desktop clients don't send our JWT (they
authenticate to Anthropic with a customer's `x-api-key`). For
audit trail attribution, sdlc.cc identifies the tenant by source
IP CIDR. Your bank's internal IP range maps to a tenant row.

Onboarding the bank:

```sql
INSERT INTO tenant_network_map (tenant_id, cidr, name) VALUES
  ('tnt_bigbank0123', '10.0.0.0/16', 'BigBank Corp HQ network'),
  ('tnt_bigbank0123', '10.10.0.0/16', 'BigBank Corp dev network');
```

(Migration `tenant_network_map` is part of the next sdlc-cc ship.)

## Trade-offs honest readout

| Trade-off | Reality |
|---|---|
| TLS interception is a real security claim | Yes. Document it for your audit team. Standard among regulated FIs. |
| Cowork could ship cert-pinning that breaks this | Possible. Mitigation: maintain `ANTHROPIC_BASE_URL` path as backup; both work. |
| Latency adds one hop | ~5-30ms inside corporate network; negligible for AI prompts (~1-3s total) |
| sdlc.cc binary needs outbound egress to real Anthropic | Whitelist `api.anthropic.com` from gateway → internet only |
| Per-tenant identification is coarser than JWT | True — IP CIDR not user. For per-user audit, customer apps still send JWT to direct sdlc.cc routes |

## Comparison to other paths

| Path | What it catches | Customer effort |
|---|---|---|
| **Transparent proxy** (this doc) | Cowork + Code + Desktop + web + extensions | 1h: corp CA + DNS + container |
| `ANTHROPIC_BASE_URL` MDM | Code + SDK only | 0.5d: per-device MDM rollout |
| Direct integration | The customer's own apps | Per-app code change |
| Firewall + replace | Block claude.ai; force everyone to Code | 1d: firewall rules + comms |

For a bank deploying the new Cowork financial agents Anthropic
announced this week, transparent-proxy is the only mode that
actually lands DLP on the agents' traffic.
