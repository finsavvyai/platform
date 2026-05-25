## Show HN: PipeWarden — open-source security scanner for CI/CD pipelines (GitHub, GitLab, Bitbucket, Jenkins, Azure)

**Post title:**
Show HN: PipeWarden – monitor what your CI/CD pipelines actually do, not just what's in the code

---

**Body:**

After SolarWinds and the xz backdoor, the attack surface shifted: your pipeline is now as dangerous as your code.

I built PipeWarden to give teams a single tool that watches all their CI/CD pipelines across GitHub Actions, GitLab CI, Bitbucket, Jenkins, Azure DevOps, and CircleCI simultaneously.

What it does:
- Heuristic scanner: 5 categories of pipeline-specific checks (secret exposure in logs, unpin action refs, privileged runners, etc.)
- AI analysis via Claude: structured severity ratings with remediation steps
- DLP scanner: 13 regex patterns for AWS keys, GitHub/GitLab tokens, SSH keys, JWTs
- SARIF 2.1.0 export for GitHub Security tab integration
- OPA-style policy engine: 8 default policies (require-tests, no-secrets-in-env, pin-actions, etc.)
- Embeddable findings widget: iframe drop-in for existing dashboards
- SIEM routing: Slack Block Kit, PagerDuty, Jira

The "CrowdStrike for CI/CD" framing: most tools scan your source code. PipeWarden scans what the pipeline *does* — which runners it uses, what secrets it touches, whether actions are SHA-pinned.

Self-host via Docker + Cloudflare Tunnel, or use the hosted version at pipewarden.com.

Open source (MIT): https://github.com/finsavvyai/pipewarden

Would love feedback on: (1) which platform matters most to you — GitHub vs GitLab vs Jenkins? (2) what compliance reports are blocking your team — SOC2, HIPAA, PCI-DSS?

---

**First comment (prepared):**

Hi HN — author here.

A few things that might interest this audience:

**Why pipelines, not code?** Code scanners (Snyk, Semgrep, CodeQL) are excellent but they miss runtime pipeline behavior: a workflow that downloads and executes a shell script from a URL won't show as malicious in static analysis. PipeWarden watches the pipeline definition and execution history.

**The xz-utils incident** was my original motivation. The malicious code was injected via a CI script, not the source. Existing scanners didn't catch it at the pipeline level.

**Architecture:** Go 1.24 + SQLite (upgradeable to Postgres), single binary, ~15MB Docker image. The AI analysis uses Claude via ClawPipe routing — if you're air-gapped, it falls back to Ollama locally.

**Action pinning** is the most common finding we see. `uses: actions/checkout@v4` can be compromised via a tag reassignment. SHA-pinning (`@8ade135a...`) prevents that. We detect and alert on all unpinned action references.

Happy to answer questions on the implementation, threat model, or how to self-host.
