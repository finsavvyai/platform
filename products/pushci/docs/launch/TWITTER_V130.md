# PushCI v1.3.0 — Twitter/X Thread

## Tweet 1 (Hook)

So your CI tool supports Go, Node, and Python. Three languages. That's the whole list. Meanwhile your team has Rust, Kotlin, Terraform, and an intern writing Elixir. But sure. Three is fine. Everything's fine.

## Tweet 2 (The Reveal)

PushCI v1.3.0 supports 33 stacks. Go, Rust, Java, C#, Ruby, PHP, Swift, Dart, Elixir, Zig, Kotlin, Lua, Perl, R, Julia, OCaml, Nim, Crystal, Erlang, V, Terraform, Helm, Solidity, Bun, Fortran, Expo, Electron, Angular, Vue, and more. All tested. Not "community maintained."

## Tweet 3 (Tracing)

Asked my DevOps guy where the bottleneck was. He said "somewhere in the build." Somewhere. In the build. PushCI now generates Perfetto traces. Drag into ui.perfetto.dev and see exactly which step took 47 seconds. pushci run --trace

## Tweet 4 (Flaky Tests)

The test fails once every ten runs. Nobody talks about it. Then one Friday it blocks the release and suddenly there's a meeting about "test reliability." pushci run --stress 10. Color-coded flake report. Now you have proof instead of silence.

## Tweet 5 (Parallel Agents)

Build, test, security scan, deploy — all running simultaneously on isolated git worktrees. Race strategy or consensus. Your pipeline just became a parallel system instead of a sad sequential queue.

## Tweet 6 (Notifications)

Slack, Discord, Email, Telegram, Webhook. Five channels. Add them to pushci.yml and they work. No marketplace plugin. No third-party integration. No "install this GitHub App and grant it access to everything."

## Tweet 7 (Local AI)

PushCI runs llamafile locally. AI-powered pipeline diagnosis without sending a single line of your code to anyone's cloud. Download, start, diagnose. Zero dollars. Zero data leaving your machine.

## Tweet 8 (Free Tier)

Let me be clear about what free means. Unlimited repos. Unlimited local runs. All 33 stacks. Tracing. Flaky detection. Zero dollars. Forever. Not a trial. Your machine runs the tests. We don't get involved.

## Tweet 9 (Paid Tiers)

Pro is $9/mo when you want cloud runners and AI diagnosis on someone else's computer. Team is $29/seat when your company needs SSO, audit logs, and a piece of paper that says someone is responsible.

## Tweet 10 (CTA)

npx pushci init. 30 seconds. 33 languages. Your machine. Your rules.

pushci.dev
