# Hacker News Show HN Post

## Title (80 chars max)
**Show HN: OpenSyber – Managed AI agent hosting with device-bound sessions**
(76 chars)

Alt titles:
- `Show HN: OpenSyber – Deploy an AI agent in 60s without leaking your secrets` (76)
- `Show HN: OpenSyber – AI agent hosting built after the Trivy supply chain hit` (76)

## Self-Post Body (800 words max)

Hi HN. I'm Shachar. I'm posting OpenSyber (https://opensyber.cloud), a managed AI agent hosting platform I started building after the Trivy supply chain attack on March 19, 2026, hit 45 orgs in 12 hours and walked out with the secrets from every CI pipeline it touched. Two of the impacted orgs were mine to babysit. I took it personally.

**What it is**

OpenSyber runs AI agents on per-user Hetzner VMs (1 CPU, 1GB RAM, 20GB SSD) with a Node 22-slim container, osquery, and seccomp-bpf sandboxing enabled from the first boot. You sign in with Auth.js (Google/GitHub/LinkedIn/Microsoft), click "Create Agent," and you get a running, monitored agent in about 58 seconds. We timed it from bad hotel WiFi, which is the only real benchmark that matters.

The agent reports process starts, file handle opens, and egress connections in real time to the control plane (Cloudflare Workers, Hono, 263 routes, 158 services backing them). The control plane runs rule and ML-based anomaly detection. In the current build, known-bad patterns (writing to `/etc/shadow`, spawning a shell from a non-shell parent, calling a domain the agent has never talked to) average 340ms detection latency on our test corpus.

**The stack** (because this is HN)

- API: Cloudflare Workers + Hono, 263 route files, 158 services, D1 for data (~103 tables across 38 Drizzle schemas, 39 migrations)
- Web: Next.js 16 on Cloudflare Pages, 452 source files, 165 React components
- Agent runtime: Node 22-slim in Docker on Hetzner, 14-file daemon with 12 monitor modules
- Auth: Auth.js, HMAC-SHA256 JWT, shared package across apps
- Session security: TokenForge — a SDK we built that uses Web Crypto's non-extractable ECDSA P-256 keys for device-bound sessions. A stolen token from one machine will not verify on another because the private key lives in the originating device's secure context and cannot be exported.
- Skill marketplace: .tar.gz packages in R2, SBOM + signature required, permissions declared in manifest, enforced at runtime
- AI skills: 6 premium skills (triage, remediation, compliance writer, threat intel, incident responder, reasoning engine) via our internal LLM gateway (claw-gateway, a separate CF Worker proxying Anthropic/OpenAI/Workers AI with session state in Durable Objects)

**Real metrics from the current deployment**

- Deploy time (signup → running agent): 58s p50, 72s p95
- Detection latency (known-bad events): 340ms p50
- API route count: 263
- Test files: 782, coverage target 95% lines / 90% branches, enforced in CI
- File size cap: 200 lines, enforced in CI (not a suggestion)
- Currently running in production on the Cloudflare + Hetzner combo described above

**Honest trade-offs**

1. Hetzner per-user VMs are not free. The free tier gives you one agent and 10 runs/day, not unlimited compute. If that feels stingy, it is — because the alternative is shared kernels, and after Trivy I am not in the mood.
2. Cold-start on a brand-new account is slow-ish (58s) because we provision a fresh VM. Warm starts are sub-second.
3. The skill marketplace is small (9 skills at launch, 6 in the premium AI bundle). We're betting on quality and audit, not quantity.
4. We use Auth.js and JWT rather than opaque sessions — partly for edge latency, partly because we pair it with device-bound TokenForge for the truly sensitive flows.
5. We do not currently support bring-your-own-cloud. Enterprise tier will, but it is not live.

**Pricing**

Free / Personal $19 / Pro $79 / Team $299. LemonSqueezy handles billing. No card for free tier. Export everything if you leave — it's your data, we wrote the code, not the loyalty clause.

**What I want from HN**

Tear into the threat model. If device-bound sessions are the wrong primitive, tell me why. If 340ms detection sounds suspiciously clean, ask for the test corpus — I'll publish it. If you've seen a cleaner way to sandbox agents at this price point, I want to know.

Docs: https://docs.opensyber.cloud
Trivy post-mortem that kicked this off: https://opensyber.cloud/blog/trivy
GitHub (open-core pieces): TokenForge SDK and skill-sdk are MIT.

Thanks for reading. I'll be in the thread.

---

## Pre-written Responses to Expected Critiques

### Response 1: "How is this different from Modal?"

Fair question, and Modal is genuinely great for serverless compute. The difference is scope and threat model.

Modal is optimized for running arbitrary Python workloads cheaply with fast cold starts. Security is table-stakes, not the product. OpenSyber is optimized specifically for long-running AI agents where the attack surface is (a) the skills the agent installs, (b) the tokens it holds, and (c) the outbound connections it makes over time.

Concretely: Modal does not audit or pin third-party packages you install into your container — that's your job. OpenSyber's marketplace requires a signed manifest, SBOM, and declared permissions, enforced by the runtime. Modal does not device-bind session tokens. OpenSyber does, via TokenForge. Modal does not give you per-agent osquery telemetry streamed to a control plane with anomaly detection. OpenSyber does.

If your workload is "run a batch job on GPUs," use Modal. If your workload is "host an AI agent that holds customer keys and installs plugins from a marketplace," the threat model is different enough that the platform should be too.

### Response 2: "Device-bound sessions sound nice but what stops an attacker who compromises the device?"

Nothing. And that's the honest answer — device binding is not a silver bullet, it's a lateral-movement blocker.

The goal is specifically: if an attacker exfiltrates a session token (logs, memory dump, malicious extension, compromised backup), that token does not work from any other device, because the private key used to sign the session proof is stored as non-extractable in Web Crypto on the originating device. It literally cannot be copied out at the API level.

If the attacker owns the originating device, yes, they can forge session proofs from that device. But now they have to actually be on the device — they can't just ship the cookie to their server. That raises the cost and the blast radius dramatically.

We pair it with: short TTLs (15 min for sensitive actions), step-up re-auth for destructive operations, egress anomaly detection on the agent VM, and audit logging of every session event. Layered. It's always layered.

Our full threat model is at https://docs.opensyber.cloud/security/threat-model and I'd genuinely welcome red-team feedback.

### Response 3: "$79/mo for Pro feels steep for a dev tool."

Agreed it's not cheap, and I want to be transparent about why.

Each agent runs on a dedicated Hetzner VM. Pro includes 5 agents and 1,000 runs/month, which at our unit costs is roughly $18–22 in pure infrastructure before we pay for Cloudflare D1 writes, R2 storage, egress, the LLM tokens on the AI skills, and the security tooling (osquery storage is not free at scale). Our blended COGS on Pro is around $28–34. The rest is engineering, support, the compliance work (SOC 2 audit is $15–40k/year), and the fact that we'd like to still exist in 2027.

The free tier is a real product with no card and 1 agent + 10 runs/day. Personal at $19 is where most solo devs land and that's the price we optimized for. Pro is for small teams who need real capacity, RBAC, and the AI skill bundle. If you just want to try the thing, don't start at Pro.

And if the pricing is wrong, tell me why, with numbers. I will rewrite the page.
