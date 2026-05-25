# Show HN: PushCI -- Zero-config CI/CD that replaces GitHub Actions YAML

I got tired of writing 50 lines of YAML just to run `go test`.

Every new project meant copying a `.github/workflows/ci.yml` from another
repo, tweaking paths, fixing indentation errors, waiting 3 minutes for a
runner to spin up, and paying for compute I already have on my laptop.

So I built **PushCI** -- a CLI that auto-detects your stack and runs your
entire CI pipeline locally in one command:

```
npx pushci init   # scans repo, generates config
pushci run         # builds, tests, lints -- done
```

No YAML. No cloud runners. No credit card.

**How it works:**

- `pushci init` scans your repo for languages, frameworks, and build
  tools (Go, Node, Python, Rust, Java, Docker -- 12 languages total)
- It generates a `pushci.yml` with sensible defaults (you can override)
- `pushci run` executes each step locally with colored output
- Git hooks run it automatically on push (like a local GitHub Actions)
- Optional dashboard at pushci-app.pages.dev shows run history

**How it is different from GitHub Actions:**

- Zero config: no YAML to write, auto-detects everything
- Free compute: runs on your machine, not metered cloud minutes
- Multi-platform: works with GitHub, GitLab, and Bitbucket
- Fast: no queue time, no container boot, sub-second startup
- 16 deploy targets: Cloudflare, AWS, Vercel, Railway, Fly, etc.

**Tech stack:** Go CLI, Cloudflare Workers for webhooks, React
dashboard on Cloudflare Pages.

**Pricing:** Free for one repo. Pro ($9/mo) for unlimited repos +
dashboard. Team ($29/mo) adds shared runners and SSO.

I would love feedback on:
- Would you use this for real projects?
- Is the pricing right? Should free be unlimited repos?
- What deploy targets or languages are missing?
- Any features that would make you switch from GitHub Actions?

Site: https://pushci.dev
GitHub: https://github.com/finsavvyai/pushci
npm: `npx pushci init`
