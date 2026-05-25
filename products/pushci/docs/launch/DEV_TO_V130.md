# PushCI v1.3.0: Your CI Tool Supports Three Languages and You're Fine With That?

*33 language stacks. Performance tracing. Flaky test detection. Still $0.*

---

## Let Me Get This Straight

Your CI platform — the one you're paying for — supports Go, Node, and Python. That's it. That's the list. Meanwhile your actual team has a Terraform module, a Rust CLI, a Kotlin microservice, and an intern who insists on writing everything in Elixir.

So what happens when someone pushes the Terraform module? Nothing. It goes through. Unvalidated. Like a passport control agent who only speaks three languages working at an international airport.

I got tired of pretending this was acceptable.

PushCI v1.3.0 supports **33 language stacks**. Because that's how many languages people actually use.

## The Numbers

- **33 stacks**: Go, Node/TS, Python, Rust, Java, C#, Ruby, PHP, Swift, Dart, Elixir, Zig, Kotlin, Lua, Perl, R, Julia, OCaml, Nim, Crystal, Erlang, V, Terraform, Helm, Solidity/Foundry, Bun, Fortran — plus framework pipelines for Expo, Electron, Angular, Vue, CRA, and T3
- **22 CLI commands**
- **69 marketplace skills**
- **57 integration tests + 11 E2E tests**

Every stack tested. Every pipeline validated. Not "community maintained." Not "beta support." Tested.

## What's New

### Performance Tracing with Perfetto

I asked my DevOps guy where the bottleneck was. He said "somewhere in the build." Somewhere. In the build. That's like a doctor saying the problem is "somewhere in your body."

```bash
pushci run --trace
```

Generates Chrome Trace Event JSON. Drag it into [ui.perfetto.dev](https://ui.perfetto.dev) and see exactly which step took 47 seconds while the rest finished in 3. No other CI tool does this. Zero. I checked.

### Flaky Test Detection

The test passed on your machine. It passed in CI. It passed 9 out of 10 times. But on that tenth time, the whole team stops what they're doing for a meeting about "test reliability."

```bash
pushci run --stress 10
```

Runs each check 10 times. Color-coded flake rate report. Now you have proof that `test_payment_webhook` fails 30% of the time instead of everyone pretending it doesn't.

### Parallel Agents with Git Worktree Isolation

Build, test, security scan, and deploy — all running simultaneously on isolated git worktrees. Race strategy (first agent wins) or consensus (all must agree).

```yaml
agents:
  strategy: race
  parallel:
    - build
    - test
    - security
    - deploy
```

Your CI pipeline just became a parallel processing system instead of a sad, sequential queue.

### 5 Notification Channels

Slack, Discord, Email, Telegram, Webhook. All of them. On every run.

```yaml
notifications:
  slack:
    webhook: $SLACK_WEBHOOK
  discord:
    webhook: $DISCORD_WEBHOOK
  email:
    to: team@company.com
```

No marketplace plugin. No third-party integration. Just add it to `pushci.yml` and it works.

### Interactive Dashboard Charts

Victory.js charts replacing the hand-rolled SVG situation we had before. Build time trends, flaky test rates, cost savings over time. Looks like a real product now because it is one.

### Tailscale Fleet Discovery

Got a fleet of runners across machines? PushCI discovers peers via Tailscale MagicDNS with tag-based filtering.

```bash
pushci fleet discover --tag ci-runner
```

Distributed CI across your actual infrastructure. Not rented infrastructure. Yours.

### Llamafile Lifecycle

Run AI diagnosis without sending your code to anyone's cloud:

```bash
pushci llamafile download mistral-7b
pushci llamafile start
pushci diagnose --local
```

Download, start, stop LLM models locally. AI-powered pipeline diagnosis at $0 with zero data leaving your machine.

## The Free Tier Promise

Let me be very clear about what "free" means here:

- Unlimited repos
- Unlimited local runs
- All 33 language stacks
- Performance tracing
- Flaky test detection
- All install methods
- **$0. Forever. Not a trial.**

Your machine runs the tests. Your machine pays the electricity bill. We don't get involved.

**Pro** ($9/mo) adds AI diagnosis, cloud runners, and priority support for when you want someone else's computer involved.

**Team** ($29/seat) adds SSO, audit logs, 25 members, and an SLA for when your company requires a piece of paper that says someone is responsible.

## Try It

```bash
# Install
npm install -g pushci

# Or Homebrew
brew install finsavvyai/tap/pushci

# Or just run it
npx pushci init

# Set up CI in 30 seconds
pushci init

# Run with performance tracing
pushci run --trace

# Stress test for flaky tests
pushci run --stress 10
```

## Links

- **Website**: [pushci.dev](https://pushci.dev)
- **GitHub**: [github.com/finsavvyai/pushci](https://github.com/finsavvyai/pushci)
- **Homebrew**: `brew install finsavvyai/tap/pushci`
- **npm**: `npm install -g pushci`
- **Dashboard**: [app.pushci.dev](https://app.pushci.dev)

---

*So you're paying per minute for a CI tool that supports three languages, can't tell you where the bottleneck is, has no idea which tests are flaky, and runs everything sequentially. And when you asked about it, someone said "that's just how CI works." No. That's just how bad CI works.*

*pushci.dev*

---

*Tags: cicd, devops, opensource, productivity*
