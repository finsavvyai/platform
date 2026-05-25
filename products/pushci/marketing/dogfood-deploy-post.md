# "PushCI deploys PushCI" — the post

Use this across Twitter, LinkedIn, HN, and Dev.to when the deploy goes live.

---

## Twitter/X (post standalone, not thread)

We just deployed pushci.dev using PushCI.

The CI pipeline runs using PushCI. The deploy runs using PushCI. The tool that fixes broken CI/CD pipelines has a CI/CD pipeline. And it works.

`pushci run` — all 6 stages green.
`pushci deploy cloudflare-pages` — live in 40 seconds.

This is what "dogfooding" actually means. pushci.dev

---

## LinkedIn (longer)

We hit a milestone today: PushCI is fully deployed using PushCI.

Here's what that means technically:

Every push to main runs `pushci run` — 6 stages:
- install (go mod + npm)
- build (go build ./...)
- test: 831 tests across Go unit, E2E, and API suites, all parallel
- lint: go vet + golangci-lint + filesize enforcement
- coverage: 48.5%, enforced
- security: govulncheck (0 vulns) + gosec (0 high severity) + gitleaks (0 secrets)

Then `pushci deploy cloudflare-pages` ships the landing page to Cloudflare Pages.

We found 6 bugs while dogfooding on a 47-package pnpm+Turborepo monorepo last week. We fixed all of them. That's what made v1.7.0.

If a CI/CD tool can't run its own CI/CD, why would you trust it with yours?

Try it: npx pushci init

pushci.dev

---

## HN comment (for when someone asks "do you dogfood it?")

Yes — pushci.dev is deployed using PushCI. The CI pipeline (`pushci run`) covers build, test (831 tests across Go unit + E2E + API), lint, coverage enforcement, govulncheck, gosec, and gitleaks — all defined in pushci.yml at the repo root. Deploy is `pushci deploy cloudflare-pages`.

We found 6 bugs while dogfooding on a real 47-package pnpm+Turborepo monorepo and fixed all of them before v1.7.0. The dogfood case study is in our docs at pushci.dev.

---

## The "meta" tweet (post after deploy succeeds, screenshot the terminal)

just ran:

```
pushci run     ✓ 6/6 stages
pushci deploy  ✓ live in 38s
```

to ship the PushCI landing page.

a CI/CD tool, deployed by itself, to tell you it's a CI/CD tool.

pushci.dev

---

## Update the landing hero stat block

After deploy is confirmed live, update `web/landing/src/components/Hero.tsx`
to add to the stat bar:

```
· Deploys itself
```

So the full line reads:
33 languages · 40+ frameworks · 23 deploy targets · $0 forever · Deploys itself
