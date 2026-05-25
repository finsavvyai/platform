# PushCI Self-Hosted Runner Pool

Deploy a cluster of PushCI runners inside your network. Runners
execute pipelines against your private repos without ever
transmitting source code to PushCI infrastructure — the managed
control plane at `api.pushci.dev` only sees run metadata and
status.

## What this gives you

- **Code stays in your network** — runners clone repos, execute
  tests, and build artifacts inside your VPC. Only run metadata
  (stage name, pass/fail, duration) is sent to the control plane.
- **Custom secrets** — wire up HashiCorp Vault, AWS Secrets
  Manager, or your preferred vault via the runner's `secrets:`
  config block.
- **Enterprise compliance** — code paths subject to your WAF,
  DLP, and logging policies. No outbound data exfiltration path
  via the CI layer.

## What this is not

This is **not** a full self-hosted PushCI SaaS. The dashboard,
API, webhook ingress, and D1 database still run on PushCI's
managed Cloudflare infrastructure. Full control-plane self-hosting
is on the **H2 2026 roadmap** — [contact sales](mailto:sales@pushci.dev)
to join the pilot.

## Security — read before deploying

**This compose file mounts the host Docker socket into the runner
container.** Line 37 of `docker-compose.yml`:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

### Risk: container escape via the Docker API

The `:ro` flag makes the socket file-descriptor read-only at the
Linux VFS layer — **it does not restrict Docker daemon operations.**
Any process inside the runner container can open the socket, speak
the Docker Engine API, and call `POST /containers/create` with
`Privileged: true` and `Binds: ["/:/host"]` to spawn a sibling
container that has full access to the host filesystem. From there
it can write to `/host/etc/shadow`, pivot to kernel modules, or
install a persistent agent. **This is effectively host root.**

### Who this is safe for

The runner only executes CI pipelines defined in Git repositories
that **you have connected through the PushCI dashboard** and whose
commits are gated by your branch protections, code review, and
push permissions. In that threat model, whoever can land a
malicious `pushci.yml` already has commit access to a trusted
repo — the docker.sock mount doesn't widen the attack surface.

### Who this is NOT safe for

Do not deploy this compose file verbatim if any of these apply:

- You allow untrusted users to submit pipeline configs (public
  forks that auto-run, multi-tenant SaaS, community shared
  runners, anything resembling a CI-as-a-service).
- Your runner host also runs workloads that should remain
  isolated from CI jobs (production services, other tenants'
  data, SSH keys for unrelated systems).
- Compliance frameworks you answer to (PCI-DSS, HIPAA, FedRAMP,
  SOC 2 with strong segregation) flag privileged-container
  escape as a finding.

### Recommended hardening

Pick whichever matches your environment:

1. **Sysbox runtime** (recommended) — swap the Docker runtime to
   [nestybox/sysbox](https://github.com/nestybox/sysbox). It runs
   containers in unprivileged user namespaces and provides a
   synthetic `docker.sock` that can't escape. No YAML changes
   required in this file once sysbox is installed as the default
   runtime.
2. **gVisor / Kata Containers** — kernel-level sandboxing.
   Heavier but closes the container-escape path entirely.
3. **Kubernetes with separate build pods** — deploy the runner
   without a Docker socket and spawn each pipeline stage as its
   own Kubernetes Job or BuildKit pod via the runner's
   `k8s-runner` profile. Contact `sales@pushci.dev` for the
   hardened Helm chart.
4. **Rootless profile (preview)** — see
   `docker-compose.rootless.yml` (scaffolded, not yet production-
   ready) for a split-mode deployment that runs the runner as
   `nobody` and isolates Docker-in-Docker to a dedicated dind
   sidecar. Tracking issue: #TBD.

### Reporting issues

Security disclosures go to [security@pushci.dev](mailto:security@pushci.dev).
We run a [security policy](https://pushci.dev/security.txt) with a
90-day coordinated disclosure window.

## Prerequisites

- Docker Engine 24+ and Docker Compose v2+
- PushCI account — sign up at [app.pushci.dev](https://app.pushci.dev)
- CLI auth token — generate at [app.pushci.dev/cli-auth](https://app.pushci.dev/cli-auth)

## Quick start

```bash
export PUSHCI_TOKEN=pcl_your_token_here
docker compose up -d
docker compose logs -f runner
```

The runner will register with the control plane and start
accepting jobs for repos you've connected in the dashboard.

## Scale out

Run multiple runner replicas across hosts by giving each a unique
name:

```bash
# Host A
PUSHCI_RUNNER_NAME=runner-a-1 docker compose up -d

# Host B
PUSHCI_RUNNER_NAME=runner-b-1 docker compose up -d
```

Runners auto-load-balance — the control plane dispatches jobs to
whichever runner has free capacity matching the job's tag filter.

## Observability

Enable the bundled Prometheus + Loki stack:

```bash
docker compose --profile observability up -d
```

Runner metrics at `http://localhost:9090`, logs at
`http://localhost:3100`. Point Grafana at both for dashboards.

If you already run centralized observability (Datadog, Splunk,
New Relic), drop the `observability` profile and scrape
`runner:9090/metrics` directly.

## Configuration

All settings via environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PUSHCI_TOKEN` | *(required)* | API token from `/cli-auth` |
| `PUSHCI_API_URL` | `https://api.pushci.dev` | Control plane endpoint |
| `PUSHCI_RUNNER_NAME` | `runner-1` | Unique runner identifier |
| `PUSHCI_RUNNER_TAGS` | `linux,docker,self-hosted` | Job dispatch filters |
| `PUSHCI_RUNNER_CONCURRENCY` | `4` | Max parallel jobs |
| `PUSHCI_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## Networking

The runner needs outbound HTTPS (443) to:
- `api.pushci.dev` — control plane
- Your git host (github.com, gitlab.com, your-gerrit.internal, etc.)
- Any registries your builds pull from (Docker Hub, npm, PyPI, etc.)

No inbound ports required. If your network blocks outbound, use
the tunneled variant — contact sales@pushci.dev for setup.

## Troubleshooting

**Runner won't register**: check `PUSHCI_TOKEN` is valid — test
with `curl -H "Authorization: Bearer $PUSHCI_TOKEN" https://api.pushci.dev/api/user/me`.

**Jobs stuck in queue**: check the runner's tag set matches what
the job requires. Dashboard → Runs → Run → "assigned to" field.

**Docker-in-Docker issues**: this compose file mounts the host
Docker socket. For rootless or Kubernetes deployments, use the
`dind` profile or switch to Podman. See [sales](mailto:sales@pushci.dev)
for hardened configurations.

## Support

- **Community**: [github.com/finsavvyai/pushci-cli/issues](https://github.com/finsavvyai/pushci-cli/issues)
- **Enterprise**: [sales@pushci.dev](mailto:sales@pushci.dev) — SLA, on-call, air-gap pilots
- **Security**: [security@pushci.dev](mailto:security@pushci.dev) — responsible disclosure
