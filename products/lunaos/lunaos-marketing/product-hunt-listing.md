# Product Hunt Listing — LunaOS

## Tagline (60 chars max)
AI code review, testing & security — straight from your CLI

## Description
LunaOS gives developers 28 specialized AI agents that cover every stage of the SDLC — code review, test generation, security audits, deployment checks, and documentation — all from one CLI that understands your entire codebase via RAG.

**The 60-second demo:**

```bash
npx luna-agents run code-review
# → Analyzing last 5 commits in src/...
# → ✗ CRITICAL  src/auth/login.ts:47   JWT secret hardcoded in source
# → ✗ HIGH      src/api/users.ts:89    No rate limiting on POST /login
# → Report → https://luna.ai/r/7f3k2m  [shareable link]
```

**Key features:**

- **RAG-Powered Context** — Indexes your entire codebase. Agents review your *actual code*, not a pasted snippet.
- **28 Built-in Agents** — Code review, security audit, test gen, deployment checks, docs, and more
- **Shareable Reports** — Every run generates a public URL. Tweet your findings.
- **Agent Chains** — Chain `code-review → test-gen → security-audit` in one command
- **CI/CD Ready** — Add to GitHub Actions in 2 lines. Block merges on critical findings.
- **Visual Studio** — Drag-and-drop workflow builder at studio.lunaos.ai (for the non-CLI folks)
- **Edge-First** — Runs on Cloudflare Workers. Sub-10ms cold starts, globally.

**Why developers switch from Copilot/ChatGPT:**
- Those tools see one file. LunaOS sees your whole repo.
- Those tools guess at context. LunaOS indexes it semantically.
- Those tools live in your IDE. LunaOS works everywhere — terminal, CI, browser.

Free tier: 100 agent runs/month (no credit card). Pro: $29/mo — unlimited runs, shareable reports, API keys, custom agents.

## Topics
- Developer Tools
- Artificial Intelligence
- Open Source
- Code Review
- DevOps

## Maker Comment
Hey Product Hunt! Solo developer here.

I built LunaOS because I kept switching between 5 different AI tools depending on what I needed: Copilot for code, ChatGPT for security questions, some online tool for docs, a script for deployment checks...

I wanted ONE thing that actually knew my codebase — not just the file I'm looking at — and could do all of it from my terminal.

After 4 full sprints, LunaOS now has:
- 28 specialized agents for every SDLC stage
- A RAG pipeline that indexes your entire repo (not just open files)
- Shareable report URLs so you can tweet what it found
- CI/CD integration so it blocks bad PRs automatically
- Everything runs on Cloudflare edge — sub-10ms cold starts

The free tier gives 100 runs/month with no credit card. That's enough to run code-review on every PR for a small project.

Would genuinely love brutal feedback — what's confusing, what's missing, what would make you actually use this daily?

## First Comment
Thanks for checking out LunaOS! Zero-setup quickstart:

```bash
# No account required — works in any git project
npx luna-agents run code-review

# Or install globally for 232 CLI commands
npm install -g luna-agents
luna init          # indexes your repo in ~30s
luna run code-review
luna run security-audit
luna chain full-review   # chains multiple agents
```

Happy to go deep on how the RAG pipeline works, the Cloudflare edge architecture, or why I built the visual Studio in addition to the CLI. Ask me anything.

## Links
- Website: https://lunaos.ai
- Dashboard: https://agents.lunaos.ai
- Studio: https://studio.lunaos.ai
- Docs: https://docs.lunaos.ai
- CLI: https://www.npmjs.com/package/@luna-agents/cli
