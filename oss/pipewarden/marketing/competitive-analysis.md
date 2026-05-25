# PipeWarden vs Snyk vs GitGuardian vs StepSecurity

Snapshot 2026-05-04. Sources: snyk.io/plans, gitguardian.com/pricing, stepsecurity.io. Update when contracts move.

## Feature matrix

| Capability | PipeWarden | Snyk | GitGuardian | StepSecurity |
|------------|:---------:|:----:|:-----------:|:------------:|
| **CI/CD platforms supported** | **6** (GHA, GLCI, BB, Jenkins, ADO, CircleCI) | 4 (GH, GL, BB, ADO repos — pipeline-level unclear) | 4 VCS (no per-pipeline) | **1** (GitHub Actions) |
| **Pipeline behavior analysis** | ✅ heuristic + AI | partial | ❌ secrets only | ✅ runtime (Harden-Runner) |
| **AI-powered remediation** | ✅ Claude-backed | ❌ | ❌ | ❌ |
| **DLP / secret scanning** | ✅ 13 patterns built-in | ✅ via Snyk Code | ✅ flagship | partial (npm focus) |
| **OPA policy engine** | ✅ 8 default + custom | partial (IaC only) | ❌ | partial (org policies) |
| **Air-gap / offline AI** | ✅ llamafile bundled | ❌ cloud only | ❌ cloud only | ❌ cloud only |
| **SARIF 2.1 export** | ✅ | ✅ | ✅ | ✅ |
| **Embeddable badge / OG card** | ✅ `/api/v1/badge/*.svg` | ❌ | ❌ | ❌ |
| **AI-agent discovery (llms.txt, ai-plugin.json)** | ✅ | ❌ | ❌ | ❌ |
| **Cost-mode routing (cheap-tier providers)** | ✅ env-flag flip | ❌ | ❌ | ❌ |
| **Self-hosted single binary** | ✅ MIT | ❌ SaaS only | enterprise tier only | ❌ SaaS only |
| **License** | MIT | proprietary | proprietary | mixed (Harden-Runner OSS) |

## Pricing

| Tier | PipeWarden | Snyk | GitGuardian | StepSecurity |
|------|------------|------|-------------|--------------|
| Free | unlimited self-host | limited tests, 5-10 dev cap | 25 devs, 500 historical | freemium |
| Mid | **$19/mo Pro** | **$25/dev/mo Team** (5-10 devs) | custom (200 dev cap) | undisclosed |
| Top | $49/mo Enterprise | $1,260/dev/yr Ignite + custom | custom | custom |

**Per-developer math at 50 devs/mo:**
- PipeWarden Enterprise: $49/mo flat
- Snyk Team: 50 × $25 = $1,250/mo (50× more)
- Snyk Ignite (annual): 50 × $1,260/yr ÷ 12 = $5,250/mo (107× more)

Even compared to GitGuardian's free 25-dev plan, PipeWarden self-hosted is unlimited.

## Strategic gaps PipeWarden should close

| Gap | Steal from | Effort | Priority |
|-----|------------|:------:|:--------:|
| Runtime egress monitoring (Harden-Runner-style) | StepSecurity | high | **P1** — biggest StepSecurity moat |
| SCA / dependency scanning | Snyk | medium | P2 — broader DevSecOps story |
| Git-history secret scan (vs current-state only) | GitGuardian | medium | P2 — common security ask |
| IDE plugins (VSCode, JetBrains) | Snyk + StepSecurity | high | P3 — shift-left |
| `.well-known/security.txt` + responsible-disclosure UX | (industry standard) | low | quick win |
| Compliance attestation reports (SOC2/ISO format) | Snyk Enterprise | medium | P2 |

## Strategic moats PipeWarden owns alone

1. **Multi-platform breadth** — only tool covering all 6 major CI/CD providers in one binary. StepSecurity is GHA-only; Snyk's pipeline-level scan is unclear beyond repos.
2. **AI remediation via Claude** — the three competitors all offer detection without AI-generated fixes. PipeWarden ships a fix-PR batch endpoint.
3. **Air-gap variant** — bundled llamafile means PipeWarden runs in classified/isolated environments where Snyk/GitGuardian/StepSecurity literally cannot.
4. **Cost-routing** — `PIPEWARDEN_CHEAP_MODE=1` routes to gemini/deepseek for ~10-25× lower spend than competitors who hard-route to GPT-4o or proprietary models.
5. **Backlink badge loop** — every "Powered by PipeWarden" embed in a customer's README is a referral path. Snyk and GitGuardian don't have this surface.
6. **MIT license + self-host** — only PipeWarden has both. StepSecurity's Harden-Runner is OSS but the platform is SaaS-only.

## Differentiation positioning

> **"CrowdStrike for CI/CD pipelines, on every platform, at one-tenth the cost."**
>
> Snyk scans your code. GitGuardian finds your leaked secrets. StepSecurity hardens your GitHub Actions runners. PipeWarden does all three across all six major CI/CD platforms, with Claude-powered fix PRs, in a single MIT-licensed Go binary you can run on your own infrastructure — including air-gapped.

## GTM action items derived from this analysis

1. **Targeted comparison landing pages** at `/vs/snyk`, `/vs/gitguardian`, `/vs/stepsecurity` — each with the relevant column from the feature matrix and the per-developer cost math.
2. **"Multi-platform" hero on website** — competitors lead with their flagship integration; PipeWarden leads with breadth.
3. **Air-gap variant marketing** — pitch to defense, finance, healthcare verticals where Snyk/GitGuardian SaaS is a non-starter.
4. **Free-forever, self-hosted, unlimited devs** — leads every comparison page.
5. **Awesome-list submissions** (per `marketing/awesome-list-prs.md`) tagged "open-source alternative to Snyk / GitGuardian / StepSecurity".
6. **Dev.to article #3 candidate**: "Why I built an open-source alternative to a $25/dev/mo SaaS" — concrete savings math for a 50-engineer team.
