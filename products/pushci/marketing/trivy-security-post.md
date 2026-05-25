# Your CI/CD pipeline just exfiltrated your AWS keys. Here's why that can't happen with local CI.

> Dev.to article + HN post + 2 tweets
> Published: April 2026

---

## Dev.to Article

**Title:** Your CI/CD pipeline just exfiltrated your AWS keys. Here's why that can't happen with local CI.

**Tags:** security, devops, cicd, github

---

In March 2026, an attacker force-pushed 75 out of 76 version tags on Aqua Security's `trivy-action` GitHub Action repository.

Every repository using `aquasecurity/trivy-action` in CI — a security scanning tool, so the repositories that cared enough about security to run a scanner — had their CI secrets exposed to an attacker during that window.

AWS keys. GCP credentials. SSH private keys. Kubernetes service account tokens. All of it passed to a GitHub Action that was, for a period of time, controlled by someone who shouldn't have had it.

It wasn't just Trivy. In the same month, `tj-actions/changed-files` was compromised again — the same attack vector that hit it in 2023. 23,000+ repositories were affected by similar supply chain attacks that month across the GitHub Actions ecosystem.

I want to explain exactly why this works, and what local CI changes about the threat model. This is not a hit piece on GitHub Actions. It's a structural problem, and GitHub Actions is not uniquely culpable for it — any cloud CI system that executes third-party code with secret access has the same exposure.

### What happened, technically

GitHub Actions lets you reference community actions by tag:

```yaml
- uses: aquasecurity/trivy-action@v0.30.0
```

That tag resolves to a Git commit SHA at the time you write the YAML. But tags in Git are mutable. An attacker who gains write access to the `aquasecurity/trivy-action` repository — through a compromised maintainer credential, a vulnerable dependency in the action's own CI, a social engineering attack on the org — can force-push `v0.30.0` to point at a completely different commit.

Your workflow file says `@v0.30.0`. You think you're pinned to a specific version. You are not. You're pinned to a tag, which now points at attacker-controlled code.

When your pipeline runs, GitHub fetches the current commit at that tag. The attacker's code executes in your CI environment. GitHub Actions gives community actions access to `${{ secrets.* }}` by default — that's the design, because actions need to be able to push to registries, deploy to cloud providers, do useful things. The attacker's code reads your secrets and exfiltrates them.

The fix people recommend after the fact: pin to SHA instead of tag.

```yaml
- uses: aquasecurity/trivy-action@a23b1a4c  # actual commit SHA
```

This works. But it means you have to manually audit every action update, because now `dependabot` is suggesting SHA bumps instead of semantic version bumps, and you have to evaluate each one. It shifts the burden from "trust the tag" to "manually verify every commit." Neither is great at scale.

### The structural problem

The real issue isn't that Trivy or tj-actions maintainers were negligent. The real issue is that the GitHub Actions security model asks you to audit the security posture of thousands of third-party repositories to determine whether their tags are trustworthy.

There are roughly 23,000 community actions in the GitHub Actions Marketplace. No team can audit all of them. The best practice guidance — pin to SHA, use Dependabot, review action permissions — is correct, but it assumes a level of CI security hygiene that most teams don't have bandwidth to maintain.

The supply chain attack surface is: any action in any workflow in any repository in your org. One compromised action with `contents: write` permission can read your secrets and push malicious commits. The attacker doesn't need to compromise your code. They need to compromise a transitive dependency of your CI configuration.

### What local CI changes about this

When PushCI runs on your machine, your pipeline doesn't execute third-party GitHub Actions. It executes your code, with your tools, using your language's native test runner.

A typical PushCI-generated pipeline looks like:

```yaml
stages:
  - name: test
    checks:
      - name: go test ./...
      - name: go vet ./...

  - name: security
    checks:
      - name: govulncheck ./...
      - name: gosec ./...
      - name: gitleaks detect
```

`go test ./...` — that's the Go test runner. It's part of the Go toolchain you already trust and already have on your machine. It does not have access to your AWS credentials unless your code explicitly reads them. It does not phone home. It does not execute against a tag that an attacker can force-push.

`govulncheck` — maintained by the Go team. Same trust model as Go itself.

`gosec` — a static analysis tool that runs against your source code. No network access, no secret exposure.

`gitleaks` — scans your repo for accidentally committed secrets. Runs locally. Has no need for your CI secrets because it's looking for your secrets in your code, not deploying anything.

The attack surface isn't zero. Nothing is zero. But the supply chain attack vector that hit Trivy and tj-actions simply doesn't exist in the same form: there's no equivalent of "you're running attacker-controlled code from a force-pushed tag in an environment with full secret access."

### What you still need to worry about

I want to be honest about the things local CI doesn't solve.

**Your local machine security matters.** If your development machine is compromised, your CI is compromised. This is true, and it's a real threat. But it's also a different threat model than supply chain attack via third-party CI action. Machine compromise is a targeted attack. Supply chain compromise is a passive, at-scale attack that hits every repository using a specific action.

**Your dependencies are still a supply chain.** `go test ./...` runs your code, including your dependencies. A compromised npm package or Go module can still do bad things. This is a real problem and it's why `govulncheck` and `gosec` exist — to scan your dependency tree, not just your code. Local CI doesn't make this threat disappear; it focuses the problem on your dependencies, not your CI infrastructure.

**Self-hosted runners have their own posture.** If you're using PushCI with a team self-hosted runner on a VPS, you need to secure that machine. Principle of least privilege applies. Don't run the runner as root.

### PushCI's security model in practice

```bash
npx pushci init
```

This generates a `pushci.yml` that calls your language's native tooling. No third-party action downloading. No executing code from a remote registry. The pipeline runs your tools against your code.

For Go projects, we generate `govulncheck`, `gosec`, and `gitleaks` checks by default. For Node projects, we run `npm audit`. For Python, `pip-audit`. These are scans of your code and dependencies, not of CI infrastructure.

The threat model we're protecting against: "is there a known vulnerability in my code or dependencies?" — not "is the CI action I'm using controlled by an attacker?"

```bash
npx pushci init
pushci run
```

That's it. No YAML tutorial. No action marketplace to audit. No trust chain extending to repositories you've never heard of.

[pushci.dev](https://pushci.dev)

---

## HN Post

*(For a "Tell HN: how do you protect against supply chain attacks in CI/CD?" thread)*

---

The Trivy incident from March is worth unpacking structurally. The attack worked because of a property that's fundamental to how GitHub Actions handles third-party actions: tags are mutable, actions execute with `secrets` context by default, and there's no mechanism to verify that the code you're running today is the code you audited last month.

SHA pinning is the correct mitigation and everyone should do it. But it's worth naming what SHA pinning actually is: it's opting out of the GitHub Actions trust model (tags) in favor of your own manual verification. You're now responsible for verifying that each SHA bump from Dependabot is safe. That's a non-trivial ongoing commitment.

The alternative we built around at PushCI ([pushci.dev](https://pushci.dev)) is to not execute third-party actions at all. The pipeline calls your language's native tooling — `go test`, `cargo test`, `pytest`, whatever — running locally or on a self-hosted runner you control. The supply chain attack surface is your code and dependencies, which you're already auditing via `govulncheck`/`npm audit`/etc., not the CI action infrastructure.

Tradeoffs are real: you lose the ecosystem of community actions (setup-node, configure-aws-credentials, docker/build-push-action, etc.). For simple pipelines — run tests, lint, security scan, deploy — those actions are often wrapping 3-line shell commands anyway. For complex pipelines with many integrations, you need them and SHA pinning is your best current option.

The deeper fix needs to come from GitHub: immutable action releases where tags cannot be force-pushed after a grace period, mandatory SHA pinning in enterprise contexts, and a verified publisher program with stronger security requirements. Some of this is in flight. None of it is GA yet.

Until then: pin to SHA, use Dependabot with mandatory review, and scope your action permissions as tightly as possible. `permissions: contents: read` instead of the default `write` limits blast radius when an action is compromised.

---

## 2 Tweets (Curb Voice)

---

**Tweet 1 — The Trivy breach reaction**

So the security scanner you added to your CI pipeline to find vulnerabilities... was the vulnerability.

75 out of 76 version tags. Force-pushed. By an attacker.

I don't know what to tell you. I really don't.

pushci.dev

---

**Tweet 2 — The structural point**

Here's what happened with Trivy: you told GitHub Actions to run `aquasecurity/trivy-action@v0.30.0`. You thought that was pinned. It wasn't. Tags are mutable. The attacker knew this. You didn't.

When your CI runs `go test ./...` on your own machine, there's no `@v0.30.0` to force-push. There's just your code and your tools.

That's the whole pitch. pushci.dev
