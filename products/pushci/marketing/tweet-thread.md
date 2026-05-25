# PushCI Launch Thread — Twitter/X

---

**Tweet 1 — The Hook**

GitHub just started charging $0.002/min for self-hosted runners.

That was the free option. The one you switched to because $0.008/min for hosted was too much.

They put a meter on the escape hatch.

---

**Tweet 2 — What PushCI Does**

One command: `npx pushci init`

It detects your stack, writes your CI config, and runs your pipeline. On your machine. Using your CPU.

No YAML. No account. No cloud. No bill.

pushci.dev

---

**Tweet 3 — The Zero-Config Moment**

This is the actual output:

```
Detected: Node.js / pnpm / Turborepo
Generated: pushci.yml
Running pipeline...
  install   pnpm install      ✓  8.2s
  build     turbo run build   ✓  12.4s
  test      turbo run test    ✓  6.1s
Pipeline passed in 26.7s
```

You typed one command. It figured out the rest.

---

**Tweet 4 — The Math**

Your team: 200 builds/day, 4 min avg.

GitHub Actions: $0.008/min × 4 min × 200 builds × 365 days = $23,360/yr

PushCI: $0

Not $0 after discounts. Not $0 with credits. Just $0. Because it runs on your computer.

---

**Tweet 5 — The Dogfood Tweet**

We ran PushCI on our own 47-package monorepo before shipping.

It found 6 bugs in PushCI itself. We fixed all 6. Wrote regression tests. Shipped.

I want to be clear: the tool found bugs in the tool that built the tool. That's either very good or very bad. We're choosing very good.

---

**Tweet 6 — The AI Angle**

When a build fails, `pushci diagnose` asks an AI what happened.

Not a specific AI — YOUR AI. Groq, Anthropic, DeepSeek, OpenAI, Gemini, or a local model. Whichever key you have.

You own the provider. You own the cost. We don't sit in the middle and charge you for the conversation.

---

**Tweet 7 — Multi-Platform**

GitHub. GitLab. Bitbucket. All three, same command.

Your CI runs locally, status posts to whichever platform you use. Switch platforms and nothing about your pipeline changes.

We don't care which git host you picked. We're not trying to lock you into ours.

---

**Tweet 8 — Migration**

Already have GitHub Actions workflows?

`pushci actions run` runs them as-is. No rewriting. No migration. Your `.github/workflows/*.yml` files work today.

When you're ready to simplify, `pushci init` generates the lean version. Until then, keep what you have.

---

**Tweet 9 — What People Say**

"I stopped paying for CI and nothing bad happened. That worried me." — a developer

"My builds fail just as often... but now it feels fair." — another developer

"I told my DevOps guy about PushCI. He said 'that can't be real.' I ran it. He watched. Long silence." — someone who enjoys awkward moments

---

**Tweet 10 — CTA**

v1.7.0. 831 tests passing. 33 languages. Bootstrapped.

If you've ever looked at your CI bill and thought "I could just... not" — this is the not.

npx pushci init

pushci.dev
