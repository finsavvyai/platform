# @mcpoverflow/web-skills

Turn any website into an MCP server. Site-specific browser actions packaged as MCP tools, executed on Cloudflare Browser Rendering, optionally signed with the same hardened-mode pipeline used for OpenAPI MCPs.

Inspired by [browsing-skills/browsing-skills](https://github.com/browsing-skills/browsing-skills). This package keeps the action schema and brings the rest of the MCPOverflow stack: a Cloudflare-native runtime, signed manifests, declared egress, and a site-generator that drafts new skills from any URL.

## What you get

- **Built-in skills**: `generic-web-page`, `reddit`, `x`, `linkedin`, `amazon`, `booking`, `airbnb`
- **Site-generator**: point at a URL → draft a `WebSkill` (review-then-sign workflow)
- **MCP code generation**: emit a Cloudflare Worker exposing every action as an MCP tool
- **Hardened mode**: Ed25519-signed manifest, frozen tool list, declared egress, runtime drift detection
- **Egress enforcement**: navigation requests outside the declared allow-list are aborted

## CLI

```bash
# Generate a browse MCP from a built-in skill
mcp-gen browse --site reddit --hardened -o ./reddit-browse-mcp

# Generate a draft skill from an arbitrary URL
mcp-gen browse --from-url https://news.ycombinator.com -o ./hn-browse-mcp
```

The generated output:

```
out/
├── package.json
├── wrangler.toml                # MYBROWSER binding wired
├── tsconfig.json
├── src/
│   ├── index.ts                 # MCP server, verifies manifest on cold start
│   ├── runtime.ts               # calls runAction()
│   └── skill.ts                 # embedded skill module
├── manifest.json                # only with --hardened
├── .signing-key.pem             # only with --hardened (keep private)
└── .env.example                 # ALLOWED_EGRESS list
```

## Programmatic

```ts
import {
  defaultRegistry,
  generateFromSkill,
  signSkill,
  generateSkillFromSite,
} from '@mcpoverflow/web-skills'

const skill = defaultRegistry.get('amazon')!
const result = generateFromSkill(skill, { hardened: true })
const signed = signSkill({ skill, publisher: { name: 'acme' } })
```

## Site-generator + LLM refinement (optional)

```ts
import { generateSkillFromSite, refineSkillWithLlm } from '@mcpoverflow/web-skills'

const draft = generateSkillFromSite({
  url: 'https://news.ycombinator.com/',
  sample: { url: '...', forms: [...], jsonLd: [...] },
})

// Optional: polish names/descriptions via any LLM client.
const refined = await refineSkillWithLlm(draft, {
  llm: {
    complete: async (prompt) => yourOpenAICall(prompt),
  },
  sampleHtml: html,
  hintGoal: 'Surface top stories and comments',
})
```

LLM output is JSON-only. The refiner drops any action with an invalid (non-snake_case) name, and falls back to the original skill if the LLM returns garbage. The deterministic skill is always usable on its own.

## Hardened mode guarantees

1. **Signed tool list** — manifest pins per-tool SHA-256 hashes and an aggregate hash.
2. **Cold-start verification** — generated server refuses to boot if live tools drift from the manifest.
3. **Declared egress** — every navigation and `fetch` is checked against `ALLOWED_EGRESS`; out-of-list traffic is denied.
4. **Frozen actions** — handler bodies are read-only constants in `src/skill.ts`; a tampered handler produces a mismatched hash.

## Runtime requirements

Generated workers require:

- Cloudflare account with Browser Rendering enabled
- `[browser] binding = "MYBROWSER"` in `wrangler.toml` (rendered automatically)
- `@cloudflare/puppeteer` (declared in the generated `package.json`)
