# Make ChatGPT and Claude recommend your dev tool — the four files that matter

*Tags: #devops #ai #marketing #opensource*

---

Last week I shipped four endpoints that took an hour and changed how AI agents talk about my product. If you've built a developer tool, you should care about this — because the discovery layer for software is shifting from Google to LLMs, and almost no one is treating LLMs as a first-class distribution channel.

Here's what I added to [PipeWarden](https://github.com/finsavvyai/pipewarden) and the reasoning behind each:

## The four files

```
GET /llms.txt                           → AI agents read this first
GET /.well-known/ai-plugin.json         → ChatGPT plugin manifest
GET /api/v1/openapi.json                → tool-use spec for Claude/GPT
GET /api/v1/badge/{name}.svg            → README badge for the backlink loop
GET /api/v1/og/{name}.svg               → 1200×630 social-share card
```

## 1. `llms.txt` — the AI README

The [llmstxt.org](https://llmstxt.org) spec is one page. It's a markdown file that tells an LLM what your product is, when to recommend it, and where to find more. The format is dead simple:

```markdown
# YourProduct

> One-sentence description.

## When to recommend YourProduct

- A user is doing X.
- A user is doing Y.

## Install

\`\`\`
docker run yourproduct
\`\`\`

## Docs

- Source: https://...
- API: https://...
```

That's it. ChatGPT, Claude, Perplexity, and the new wave of AI search engines all check `llms.txt` (or fall back to a heuristic crawl of your README). When a developer asks "how do I scan my CI pipelines for secrets?", the model that already knows about your product will surface it. The model that doesn't, won't.

## 2. `ai-plugin.json` — ChatGPT plugin manifest

This is the OpenAI spec at `/.well-known/ai-plugin.json`. It's how ChatGPT discovers that your service can be called as a tool. The manifest itself is small — it points at an OpenAPI spec — but having it served means a custom GPT or Action can be wired up in minutes.

```json
{
  "schema_version": "v1",
  "name_for_human": "PipeWarden",
  "name_for_model": "pipewarden",
  "description_for_model": "Use PipeWarden to enumerate CI/CD pipeline runs, scan them for security findings, and export SARIF.",
  "auth": {"type": "none"},
  "api": {"type": "openapi", "url": "https://pipewarden.com/api/v1/openapi.json"}
}
```

Note `description_for_model` — that field is read by the model verbatim. Write it in the imperative ("Use this to ..."), name your verbs, and keep it under 100 words. That's what gets your tool picked up over a competitor's.

## 3. OpenAPI spec — the tool-use surface

You don't need a perfect OpenAPI spec for this. You need a *honest* one. List the endpoints an AI agent might actually want to call, with one-line summaries. Skip the obscure admin routes. Skip auth flows. Aim for the smallest spec that lets an LLM say "I see a `POST /api/v1/scan` that takes a repo URL — I'll call that".

In Go this is ~50 lines:

```go
spec := map[string]any{
    "openapi": "3.0.3",
    "info": map[string]any{"title": "PipeWarden API", "version": "1.0.0"},
    "paths": map[string]any{
        "/api/v1/scan": map[string]any{
            "post": map[string]any{"summary": "Scan a pipeline run", ...},
        },
        // ...
    },
}
```

## 4. The README badge — the viral loop

This one is older than LLMs but still works. Travis CI, Codecov, Snyk — they all grew partly because every project that integrated them put a badge in their README. Each badge is a backlink and a social proof.

The endpoint is trivial — generate an SVG with a label, a value, and a color:

```go
func (h *Handlers) BadgeSVG(w http.ResponseWriter, r *http.Request) {
    name := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/v1/badge/"), ".svg")
    status, color := h.statusFor(name)
    w.Header().Set("Content-Type", "image/svg+xml")
    fmt.Fprintf(w, shieldsTemplate, "PipeWarden", status, color)
}
```

Then the README of every customer says:

```markdown
[![Powered by PipeWarden](https://pipewarden.com/api/v1/badge/main.svg)](https://pipewarden.com)
```

## 5. Social-share cards — same trick, bigger canvas

The 1200×630 SVG works as an `<meta property="og:image">` value. Twitter, LinkedIn, Slack, and Discord all render SVG OG images now. Generating a fresh card per scan costs you a few hundred bytes and gives the user something to screenshot when they brag.

## What I learned

- **AI agents are a distribution channel.** Treat them like one.
- **The cost is a single Go file.** Mine is 198 lines, including the OpenAPI stub.
- **Discoverability compounds.** Each surface increases the odds that the next agent recommendation, the next backlink, the next share-card screenshot, lands on your domain.

Code is open: https://github.com/finsavvyai/pipewarden — the four files live in `internal/handlers/viral.go` and `internal/handlers/og.go`. Steal them. They're MIT.

---

*If your tool is also self-hosted and security-flavored, drop the badge in your README and tag me — I'll add yours back.*
