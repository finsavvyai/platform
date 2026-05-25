# Tailnet integration (Enterprise)

Status: code shipped (default-build neutral, `-tags pipewarden_mesh` enables
tsnet). The `tsnet` implementation lives in `internal/mesh/mesh_tsnet.go` and
is wired through `internal/handlers/helpers.go::buildProvider`. The
remaining work is operator-side: provisioning auth keys and ACLs.

## Why

Many Enterprise CI/CD targets (self-hosted Jenkins, on-prem GitLab,
internal Bitbucket DC) live behind a corporate firewall. PipeWarden's
default mode requires inbound HTTPS to those endpoints, which is a
non-starter for those buyers. With Tailscale embedded as a userspace
WireGuard node (`tailscale.com/tsnet`), the PipeWarden agent joins the
customer tailnet and reaches private endpoints over the mesh — no
inbound firewall changes, no exposed PATs travelling over the public
internet.

## Architecture

```
┌────────────────────┐                  ┌────────────────────┐
│ pipewarden agent   │ ── tsnet ──▶    │ jenkins.corp.ts.net│
│ (tag:pipewarden)   │                  │ (tag:ci-internal)  │
└────────────────────┘                  └────────────────────┘
        ▲
        │ ACL: tag:pipewarden may dial *:443 on tag:ci-internal
        │
   tailnet auth-key (ephemeral, tagged, per-deployment)
```

Key properties:

- The agent is a **userspace** node, not a kernel WireGuard tunnel —
  no privileged install on the host.
- Auth keys are **tagged** (`tag:pipewarden`) and **ephemeral**, so a
  compromised agent expires from the tailnet without operator action.
- The agent only ever **dials out**; it does not accept inbound
  tailnet traffic.

## Canonical ACL

Customer pastes this into their Tailscale admin console
(`https://login.tailscale.com/admin/acls`). The `acls` block is the
minimum needed to let PipeWarden reach CI servers tagged
`tag:ci-internal`; nothing more is granted.

```jsonc
{
  "tagOwners": {
    "tag:pipewarden":    ["group:platform-eng"],
    "tag:ci-internal":   ["group:platform-eng"]
  },
  "acls": [
    {
      "action": "accept",
      "src":    ["tag:pipewarden"],
      "dst":    ["tag:ci-internal:443", "tag:ci-internal:8443"]
    }
  ],
  "tagOwners": {
    "tag:pipewarden": ["group:platform-eng"]
  },
  "ssh": []   // PipeWarden never uses tailnet SSH
}
```

Tagged endpoints `tag:ci-internal` typically include:

| Hostname pattern         | Used by                          |
|--------------------------|----------------------------------|
| `jenkins.*.ts.net`       | Jenkins provider                 |
| `gitlab.*.ts.net`        | self-hosted GitLab provider      |
| `bitbucket.*.ts.net`     | Bitbucket Data Center provider   |
| `azure-devops.*.ts.net`  | Azure DevOps Server (on-prem)    |

## Operator runbook

```bash
# 1. Build the mesh-enabled binary:
go build -tags pipewarden_mesh -o bin/pipewarden ./cmd/pipewarden

# 2. Mint an ephemeral auth key tagged `tag:pipewarden` in the Tailscale
#    admin UI, then export it (the agent never persists this to disk):
export PIPEWARDEN_MESH_ENABLED=true
export PIPEWARDEN_MESH_PROVIDER=tailscale
export TAILSCALE_AUTHKEY=tskey-auth-xxxxxxxx
export PIPEWARDEN_MESH_HOSTNAME=pipewarden-prod-1
export PIPEWARDEN_MESH_STATE_DIR=/var/lib/pipewarden/mesh

./bin/pipewarden serve   # boots tsnet listener; provider HTTP clients dial via tailnet
```

When `PIPEWARDEN_MESH_ENABLED` is unset (the default), the agent
boots without joining any tailnet — the feature is opt-in and tier-gated.

When the binary is built **without** `-tags pipewarden_mesh` and
`PIPEWARDEN_MESH_ENABLED=true` is set anyway, `mesh.Init()` returns
`ErrNotBuilt` so the misconfiguration is loud, not silent.

## What the runtime does

Once N1 ships, the PipeWarden agent will:

1. Boot a `tsnet.Server` if `TAILSCALE_AUTHKEY` is set.
2. Resolve any provider URL whose host matches `*.ts.net` through
   the tsnet dialer.
3. Fall back to the standard transport for non-`ts.net` hosts.
4. Log the assigned tailnet hostname once per boot (no key material).

## Tier gating

Tailnet integration is **Enterprise-only**. The free and Pro tiers
ignore `TAILSCALE_AUTHKEY` and emit a one-line warning if it
is set, so that misconfigured downgrade paths surface clearly.

## Security posture

- Auth keys are **never persisted** to disk; they are read from env
  on boot and discarded.
- The agent is **outbound-only** on the tailnet — incoming tailnet
  traffic is rejected at the listener level.
- The Mythos canon (`CLAUDE.md → Mythos`) forbids any flow that
  combines (private data) × (untrusted content) × (outbound). The
  tailnet path is *outbound to the customer's own tailnet*; no
  untrusted ingestion is involved, so it does not invoke that block.

## Open questions for N1 implementation

- [ ] Should we also support ACL tags per-connection (e.g.
  `tag:pipewarden-jenkins-prod`) for finer least-privilege?
- [ ] Do we need a `pipewarden mesh status` subcommand surfaced in
  the dashboard for operators?
- [ ] Per-tenant tailnet auth or shared (likely per-tenant for SaaS,
  shared for self-hosted)?

These are decided when the N1 PR opens; this stub is the contract
sales can show today.
