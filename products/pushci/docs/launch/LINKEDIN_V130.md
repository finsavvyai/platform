# PushCI v1.3.0 — LinkedIn Post

---

I built PushCI because my CI tool couldn't handle my actual stack.

We had Go, Terraform, Rust, and Kotlin across six repos. Our CI platform supported three of those. The Terraform module went through unvalidated on every push. Nobody noticed for weeks. When I asked about adding support, I was told to "write a custom action." So I did something different.

PushCI v1.3.0 now supports 33 language stacks out of the box. Go, Rust, Java, C#, Swift, Kotlin, Elixir, Zig, Terraform, Helm, Solidity — all tested, all with real pipelines. Not community plugins. Not beta support.

But language support was just the starting point. Here is what else shipped:

Performance tracing with Perfetto. Run pushci run --trace and get Chrome Trace Event JSON. Drag it into ui.perfetto.dev and see exactly which pipeline step is the bottleneck. No more "somewhere in the build."

Flaky test detection. Run pushci run --stress 10 to execute each check ten times with a color-coded flake rate report. The test that fails 30% of the time is now visible instead of ignored.

Parallel agents on isolated git worktrees. Build, test, scan, and deploy simultaneously with race or consensus strategies. Pipelines that used to run sequentially now finish in a fraction of the time.

Five notification channels — Slack, Discord, Email, Telegram, Webhook — configured in three lines of YAML. No plugins required.

The free tier includes everything above. Unlimited repos, unlimited local runs, all 33 stacks, tracing, flaky detection. Zero cost, forever. Your machine runs the tests.

Pro ($9/mo) adds cloud runners and AI diagnosis. Team ($29/seat) adds SSO, audit logs, and SLA.

If your CI tool charges per minute and still cannot tell you which test is flaky, it might be time to try something different.

npx pushci init — 30 seconds to set up.

pushci.dev

#CICD #DevOps #OpenSource
