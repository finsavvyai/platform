# OpenSyber Landing Page Copy

## Hero Section

### Headline (Bebas Neue, 96pt on desktop)
**AI AGENTS.**
**HOSTED.**
**NOT EXFILTRATED.**

### Sub-headline (DM Sans, 20pt, 60% opacity)
Deploy a managed AI agent on its own isolated VM in 58 seconds. Every skill audited. Every session device-bound. Built after Trivy, for people who learned.

### Primary CTA
`START FREE →` (teal #00E5C3 fill, black text, no card required)

### Secondary CTA
`SEE THE 60-SECOND DEMO` (outline button, opens hero video modal)

### Hero metric strip (below CTAs, mono, small caps)
`58s DEPLOY · 340ms DETECTION · 0 SHARED KERNELS · SOC 2 READY`

---

## Value Prop Section 1 — Speed

### Headline
**SIXTY SECONDS. MEASURED.**

### Body
Signup to a running, monitored agent in under a minute. We clicked the stopwatch from a hotel WiFi in Lisbon, because that's the only real benchmark. The agent boots on its own Hetzner VM with osquery and seccomp enabled before your first prompt lands. No Docker YAML. No Kubernetes cluster. No 14-step setup wizard that somehow still asks for your birthday.

### Micro-proof
`p50 deploy: 58s · p95 deploy: 72s · cold start to first prompt: 340ms`

---

## Value Prop Section 2 — Safety

### Headline
**THE SKILL MARKETPLACE THAT SAYS NO.**

### Body
Every skill is signed, SBOM-verified, and ships with declared permissions enforced at runtime. If a skill tries to read a file it didn't declare, the agent kills the process in 340 milliseconds — before the syscall returns. When the maintainer pushes a bad update, your agent doesn't automatically eat it. Revolutionary concept: asking first.

### Micro-proof
`9 skills at launch · SBOM required · signature required · permission manifest enforced`

---

## Value Prop Section 3 — Sovereignty

### Headline
**DEVICE-BOUND SESSIONS. ACTUALLY.**

### Body
TokenForge binds your session to your device with non-extractable ECDSA P-256 keys in Web Crypto. A stolen token from your logs, your memory, or a malicious extension does not work from any other machine. Pair that with per-agent egress monitoring, short TTLs, and audit logs your compliance team can hand to a lawyer without crying, and you have a platform that treats lateral movement as the enemy it is.

### Micro-proof
`ECDSA P-256 · non-extractable · step-up re-auth on destructive ops · full audit log export`

---

## Social Proof Section

### Section headline
**TRUSTED BY ENGINEERS WHO READ THE POST-MORTEMS**

### Layout
Logo carousel (6–8 customer logos, grayscale, muted), followed by 3 testimonial cards.

### Testimonial card template

> "We rebuilt our agent stack on OpenSyber three weeks after the Trivy incident. The detection latency claims checked out. The compliance export saved us a week on our SOC 2 audit."
>
> **— [Name], [Title], [Company]**
> [company logo, 32px]

> "I deployed my first agent in under a minute and spent the rest of the hour actually testing my prompts instead of fighting a Kubernetes cluster."
>
> **— [Name], [Title], [Company]**

> "The skill marketplace signature check caught a typo-squat on day three. Alone that paid for the year."
>
> **— [Name], [Title], [Company]**

### Metric strip (below testimonials)
`[X,XXX] agents deployed · [XXX] orgs · [X.XX]M runs executed · [XX] skills published`

(populate with real numbers at launch — do not ship with placeholders in production)

---

## FAQ Section

### Section headline
**QUESTIONS PEOPLE ACTUALLY ASK.**

### Q1: How is this different from Modal or Replit?
Modal is great for serverless compute and Replit is great for IDE-first development. Neither was built around the AI agent threat model — specifically, audited skills, device-bound sessions, and per-agent egress anomaly detection. If your workload is "run a Python batch job," use Modal. If your workload is "host an AI agent that holds customer keys and installs plugins from a marketplace," the threat model is different enough that the platform should be too.

### Q2: What happens if OpenSyber goes down?
Agents keep running on their Hetzner VMs even if our control plane is offline — they degrade gracefully and queue events locally. When the control plane returns, events replay in order. You can also export every agent config, skill, and credential at any time. Your data is yours, and we built the off-ramp on day one.

### Q3: Is 340ms detection really real?
Yes, measured on our published test corpus of known-bad patterns (shell spawn from non-shell parent, write to sensitive paths, egress to unknown domains). The full corpus and methodology are at docs.opensyber.cloud/benchmarks. If you can beat it with a different setup, I want to see it.

### Q4: What's the free tier actually good for?
One agent, ten runs per day, full security monitoring, access to the free skills, and no credit card. It's genuinely enough to build and demo a prototype. It is not enough to run production traffic — for that, Personal at $19/mo or Pro at $79/mo is where most teams land.

### Q5: Do you sell my data, train on my data, or leak my prompts?
No, no, and if we did we would deserve the lawsuit. Your prompts and responses are yours. We do not train on them. We log metadata (timestamp, skill ID, agent ID, outcome) for security monitoring and you can export or delete it. Enterprise tier gets data residency (EU/US) and BYOK.

---

## Final CTA Section

### Headline
**DEPLOY YOUR FIRST AGENT IN 58 SECONDS.**

### Sub-headline
Free tier. No credit card. Exportable at any time. Built by someone who was on-call for Trivy and decided once was enough.

### Primary CTA
`START FREE →` (large teal button)

### Secondary CTA
`READ THE DOCS` (outline, opens docs.opensyber.cloud)

### Footer microcopy
`Built after Trivy. For people who learned. © 2026 OpenSyber.`
