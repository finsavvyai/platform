# LunaOS Social Media Launch Assets

## Posting Schedule (Launch Day, PT)

| Time | Platform | Content |
|------|----------|---------|
| 12:01 AM | Product Hunt | Listing goes live |
| 7:00 AM | Twitter/X | Thread (tweets 1-5) |
| 7:30 AM | LinkedIn | Professional announcement |
| 8:00 AM | Hacker News | Show HN post |
| 9:00 AM | Reddit | r/programming, r/webdev, r/SideProject |
| 10:00 AM | Dev.to | Full article published |
| 11:00 AM | Discord/Slack | Community announcements |
| 2:00 PM | Twitter/X | Retweet thread + PH update |

---

## 1. Twitter/X Launch Thread

**Tweet 1 — Launch Announcement**
> We just launched LunaOS on @ProductHunt.
>
> 28 AI agents. One CLI. Every stage of your dev workflow covered.
>
> Code review, testing, security audits, deployment, docs — all RAG-powered with your codebase context.
>
> Free tier included. Link below.
> #DevTools #AI #ProductHunt #OpenSource

**Tweet 2 — CLI Demo**
> Here's what it looks like in practice:
>
> ```
> $ npm i -g @luna-agents/cli
> $ luna init
> $ luna run code-review
> ```
>
> [Screenshot: terminal with colored headings, inline suggestions, summary score]
>
> Three commands. Expert-level code review in 8 seconds.

**Tweet 3 — Dashboard Features**
> Don't want to leave the browser? agents.lunaos.ai lets you:
>
> - Run any of the 28 agents from a web UI
> - View run history and results
> - Manage API keys for CI/CD integration
> - Monitor usage across your team
>
> Built with Next.js 14. Sub-second loads on Cloudflare edge.

**Tweet 4 — Agent Chains**
> The real power: Agent Chains.
>
> code-review -> security-audit -> test-gen -> deploy-check
>
> Run them with one command: `luna chain full-review`
>
> Or build them visually in the Studio drag-and-drop editor at studio.lunaos.ai.

**Tweet 5 — CTA**
> LunaOS is live on Product Hunt right now.
>
> Free tier: 100 runs/month. Pro: unlimited + custom agents + teams.
>
> [Product Hunt link] | [lunaos.ai]
>
> An upvote would mean a lot. Happy to answer questions in the thread.
> #BuildInPublic #DevTools #AI

---

## 2. LinkedIn Post

**Title:** Launching LunaOS — 28 AI Agents for the Software Development Lifecycle

After four development sprints, I am releasing LunaOS publicly on Product Hunt today.

LunaOS provides 28 specialized AI agents covering every stage of the SDLC: code review, test generation, security auditing, deployment preparation, documentation, and more.

What makes it different from general-purpose AI coding assistants is context. LunaOS uses a RAG pipeline connected to your GitHub repositories, so every agent understands your actual codebase, patterns, and conventions before producing output.

The platform ships with multiple access points: a CLI for terminal-first developers, a web dashboard for browser-based workflows, a visual studio with drag-and-drop agent chain building, and a REST API for CI/CD integration. Everything runs on Cloudflare Workers with sub-10ms cold starts.

The architecture is built on Hono, Cloudflare D1 for persistence, Vectorize for RAG embeddings, and Next.js 14 for the dashboard. The entire system is edge-first with no central server bottleneck.

I built this as a solo developer because I wanted a single platform for my entire AI-assisted workflow instead of switching between five different tools. Free tier: 100 agent runs/month. Pro: unlimited runs, custom agents, team workspaces.

Product Hunt listing and docs linked in the comments.

#DeveloperTools #ArtificialIntelligence #DevOps #SoftwareEngineering #ProductLaunch

---

## 3. Reddit Posts

### r/programming

**Title:** Show r/programming: I built a platform with 28 RAG-powered AI agents for the SDLC

I have been working on LunaOS, a platform with 28 specialized AI agents for code review, testing, security audits, deployment, and documentation. The key differentiator is RAG context injection. You connect your GitHub repo, agents index your codebase into vector embeddings, and retrieve relevant context before generating output.

Tech stack: Hono on Cloudflare Workers, D1, Vectorize for embeddings, Next.js 14 dashboard, CLI via Commander.js. Edge-deployed with sub-10ms cold starts. Agent chains let you compose multi-step workflows: `luna chain full-review` runs code-review, security-audit, test-gen, and deploy-check in sequence.

Free tier: 100 runs/month. Curious what agents developers would want beyond the current 28.

### r/webdev

**Title:** Built a CLI + web dashboard with 28 AI dev agents — looking for feedback

Just launched LunaOS on Product Hunt. 28 AI agents you can run from a CLI, web dashboard, or visual workflow editor. Quick start: `npm i -g @luna-agents/cli && luna init && luna run code-review`.

Dashboard (agents.lunaos.ai): Next.js 14, Zustand, Tailwind. Visual studio (studio.lunaos.ai): ReactFlow for drag-and-drop chains. API: Hono on Workers with D1 and Vectorize for RAG. Free tier: 100 runs/month.

Would love feedback on the tooling and developer experience.

### r/SideProject

**Title:** After 4 sprints as a solo dev, I just launched my AI agent platform on Product Hunt

I built LunaOS because I was tired of switching between ChatGPT for code review, a different tool for security checks, another for test generation, and manually running deployment checklists. I wanted one platform with one command.

Today it launched on Product Hunt: CLI, web dashboard, visual workflow studio, full API, free tier (100 runs/month). Stack: Cloudflare Workers, Hono, D1, Next.js 14, React Native for mobile. Seven subdomains under lunaos.ai.

Would appreciate upvotes on PH. Happy to answer questions about the solo dev journey.

---

## 4. Hacker News

**Title:** Show HN: LunaOS -- 28 AI agents for code review, testing, security, and deployment

LunaOS is a developer platform with 28 specialized AI agents for the SDLC. Agents are RAG-powered: connect your GitHub repo and they understand your codebase context before generating output.

Install: `npm i -g @luna-agents/cli` | Run: `luna run code-review` | Chain: `luna chain full-review`

Stack: Hono on Cloudflare Workers, D1, Vectorize, Next.js 14. Sub-10ms cold starts. Free tier: 100 runs/month. Docs at docs.lunaos.ai.

---

## 5. Dev.to Article

**Title:** I Built 28 AI Agents for the Entire Dev Lifecycle -- Here's What I Learned

**Opening:** For the past several months, I have been building LunaOS, a platform with 28 specialized AI agents covering code review, test generation, security auditing, deployment, and documentation. Today I launched it on Product Hunt. This article covers the architecture, the RAG pipeline, and lessons learned building a multi-product platform solo.

**Sections:** 1) The Problem: Too Many AI Tools 2) Architecture: Cloudflare Edge-First 3) The RAG Pipeline 4) Agent Chains: Multi-Step Workflows 5) CLI, Dashboard, and Visual Studio 6) Sub-10ms Cold Starts 7) Solo Dev Lessons 8) What's Next: SDK and Marketplace 9) Try It Free

**Tags:** `#ai` `#devtools` `#cloudflare` `#typescript` `#showdev`

---

## 6. Discord / Slack Announcement

**LunaOS just launched on Product Hunt**

28 AI agents for your entire dev workflow. Code review, testing, security, deployment, docs. RAG-powered: connect your GitHub repo and every agent understands your codebase.

```
npm i -g @luna-agents/cli && luna init && luna run code-review
```

**Access:** CLI | Dashboard (agents.lunaos.ai) | Studio (studio.lunaos.ai) | API
**Free tier:** 100 agent runs/month | **Product Hunt:** [link] | **Docs:** docs.lunaos.ai

Built on Cloudflare Workers, Hono, D1, Next.js 14. Feedback welcome.

---

## Hashtag Reference

| Platform | Hashtags |
|----------|----------|
| Twitter/X | #DevTools #AI #ProductHunt #BuildInPublic #OpenSource |
| LinkedIn | #DeveloperTools #ArtificialIntelligence #DevOps #SoftwareEngineering |
| Dev.to | #ai #devtools #cloudflare #typescript #showdev |
| Reddit | No hashtags (against subreddit conventions) |
