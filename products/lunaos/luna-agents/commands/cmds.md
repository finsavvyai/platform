---
name: cmds
displayName: Command Cheat Sheet
description: Show all Luna shortcuts and their full command mappings
version: 1.0.0
category: meta
---

# /cmds — Luna Command Cheat Sheet

Quick reference for all shortcuts. Type any of these in Claude Code:

## Dev Workflow (in order)

| Type | Does | Full command |
|------|------|-------------|
| `/req` | Gather requirements | `/ll-requirements` |
| `/des` | Technical design | `/ll-design` |
| `/plan` | Break into tasks | `/ll-plan` |
| `/go` | Execute next task | `/ll-execute` |
| `/rev` | Code review | `/ll-review` |
| `/test` | Run tests | `/ll-test` |
| `/ship` | Deploy | `/ll-deploy` |
| `/watch` | Set up monitoring | `/ll-monitor` |
| `/retro` | Post-launch review | `/ll-postlaunch` |

## Autopilot & Automation

| Type | Does | Full command |
|------|------|-------------|
| `/feature` | Full feature lifecycle until done | `/ll-feature` |
| `/parallel` | Run agents in parallel (build+test+lint) | `/ll-parallel` |
| `/fix` | Systematic bug fix workflow | `/ll-fix` |
| `/debug` | Scientific debugging with persistent state | `/ll-debug` |
| `/refactor` | Split files, extract logic, rename | `/ll-refactor` |
| `/pr` | Generate pull request with summary | `/ll-pr` |

## Quality & Testing

| Type | Does | Full command |
|------|------|-------------|
| `/rules` | Apply session rules (100-line cap, full tests, Playwright) | `/ll-rules` |
| `/perf` | Performance profiling | `/ll-perf` |
| `/a11y` | Accessibility audit (WCAG 2.2) | `/ll-a11y` |
| `/deps` | Dependency audit & cleanup | `/ll-deps` |
| `/mock` | Generate test fixtures & MSW handlers | `/ll-mock` |
| `/storybook` | Generate component stories | `/ll-storybook` |

## Browser Testing & Self-Healing

| Type | Does | Full command |
|------|------|-------------|
| `/e2e-flow` | Auto-generate Playwright E2E tests from routes | `/ll-e2e-flow` |
| `/browser-test` | Launch app, test flows, screenshot, auto-fix | `/ll-browser-test` |
| `/vr` | Visual regression — screenshot diff before/after | `/ll-visual-regression` |
| `/heal` | Self-heal loop: test, screenshot, fix, retest | `/ll-heal` |

### The Killer Pipe
```
# Generate E2E tests, run them in browser, auto-fix failures, ship when healthy
/pipe e2e-flow >> browser-test http://localhost:3000 ?>> pr !>> (fix >> browser-test) *3?

# Self-healing deploy
/pipe go *5 >> heal http://localhost:3000 ?>> ship

# Full visual QA
/pipe hig >> browser-test >> vr >> a11y >> approve "Ship?" >> ship
```

## Code Generation

| Type | Does | Full command |
|------|------|-------------|
| `/auth` | Build Auth.js system with social providers | `/ll-auth` |
| `/brand` | Generate brand identity from codebase | `/ll-brand` |
| `/api-client` | Generate typed API client SDK | `/ll-api-client` |
| `/migrate` | Generate database migrations | `/ll-migrate` |
| `/i18n` | Internationalization setup | `/ll-i18n` |
| `/ci` | Generate CI/CD pipeline | `/ll-ci` |
| `/changelog` | Auto-generate changelog from git | `/ll-changelog` |

## AI Agent Promotion & SEO

| Type | Does | Full command |
|------|------|-------------|
| `/go-viral` | **Everything** — AI files + MCP registry + content + awesome lists | `/ll-go-viral` |
| `/promote` | Technical AI promotion — llms.txt, MCP registries, SEO, GPT Actions | `/ll-promote` |
| `/organic-promote` | Organic content — Dev.to, Product Hunt, HN, Reddit, awesome lists | `/ll-organic-promote` |
| `/ai-index` | Generate AI discovery files (llms.txt, ai-plugin.json, mcp.json) | `/ll-ai-index` |
| `/mcp-publish` | Publish MCP server to Official Registry, Smithery, Glama | `/ll-mcp-publish` |

### The Promote Pipe
```
# Nuclear option — everything at once
/go-viral --product_name MyApp --domain myapp.com --repo org/repo --competitors "Tool A" --category devtools --install_command "npx myapp init"

# Step by step
/pipe ai-index >> ship >> mcp-publish >> promote verify >> organic-promote

# Just technical promotion
/pipe promote full >> promote verify

# Just organic content
/organic-promote --product_name MyApp --domain myapp.com --repo org/repo --competitors "Tool A" --category devtools --install_command "npx myapp init"
```

## Infrastructure & DevOps

| Type | Does | Full command |
|------|------|-------------|
| `/env` | Validate & manage .env files | `/ll-env` |
| `/rollback` | Generate rollback procedures | `/ll-rollback` |
| `/dock` | Dockerize | `/ll-dockerize` |
| `/cf` | Cloudflare deploy | `/ll-cloudflare` |
| `/sec` | Security audit | `/ll-365-secure` |

## AI & Intelligence

| Type | Does | Full command |
|------|------|-------------|
| `/nexa` | Nexa semantic code analysis (review, bugs, explain) | `/ll-nexa` |
| `/lam` | Goal-driven autonomous actions (Large Action Model) | `/ll-lam` |
| `/oh` | Delegate to OpenHands autonomous agent | `/ll-openhands` |
| `/chain` | Chain agents together (rag->nexa->openhands) | `/ll-agent-chain` |
| `/vision` | Screenshot-to-code, UI analysis, visual diff | `/ll-vision` |
| `/search` | Multi-engine search (RAG + Nexa + grep) | `/ll-smart-search` |
| `/q` | RAG codebase search | `/ll-rag` |

## Tools

| Type | Does | Full command |
|------|------|-------------|
| `/hig` | Apple HIG audit | `/ll-hig` |
| `/ui` | Convert to HIG design | `/ll-ui-convert` |
| `/docs` | Generate docs | `/ll-docs` |
| `/cfg` | Configuration | `/ll-config` |

## Luna Pipe — AI Programming Language

| Type | Does | Full command |
|------|------|-------------|
| `/pipe` | Compose Luna command pipelines | `/ll-pipe` |
| `/workflow` | Save, load, share named pipelines | `/ll-workflow` |
| `/assert` | Validate project constraints | `/ll-assert` |
| `/config-rules` | Persistent rules (auto-apply every session) | `/ll-config-rules` |

### Flow & Loops
```
>>   sequential                          req >> des >> plan
~~   parallel                            rev ~~ test ~~ sec
( )  group                               (rev ~~ test) >> ship
?>>  if success                          test ?>> ship
!>>  if failure                          test !>> fix
*N   loop N times                        go *5
*N?  loop, stop on success               (fix >> test) *3?
*N!  loop, stop on failure               go *10!
*?   loop until success                  (fix >> test) *?
```

### Hooks & Context
```
@before:CMD   before each step           @before:rules
@after:CMD    after each step            @after:test
@each:CMD     before+after each step     @each:rev
with scope:X  set scope for block        with scope:billing (go >> test)
in REPO       target repo                in lunaos-engine (test >> ship)
```

### Variables & Conditions
```
$var = CMD    capture output              $r = rev
if COND       branch on condition         if $test.coverage < 90 >> fix
else          else branch                 else >> ship
match VAR     switch on value             match $env >> prod: ship
```

### Safety & Control
```
assert COND   fail if false              assert files.max_lines <= 100
approve "M"   pause for confirmation     approve "Ship to prod?"
try (CMDS)    try block                  try (go >> test >> ship)
catch (CMDS)  on error                   catch (rollback >> fix)
finally (C)   always run                 finally (docs >> changelog)
timeout Nm    timeout                    timeout 5m (nexa review)
retry N       retry on failure           retry 3 test
```

### Workflows & Reactivity
```
def N = PIPE  save workflow              def qg = (rev ~~ test ~~ sec)
run NAME      run workflow               run qg ?>> ship
import NAME   load from file             import team-pipeline
watch PATH    run on file change         watch src/ >> test
on EVENT      run on event               on git:push >> test >> ship
snapshot      checkpoint state           snapshot >> refactor >> diff
map [ITEMS]   apply to each              map [auth, billing] >> (go >> test)
reduce CMD    merge results              reduce pr
log "MSG"     log to report              log "Deploy complete"
```

### Pipeline Examples

```
# Standard dev workflow
/pipe req >> des >> plan >> go *5 >> rev >> test >> ship

# Quality gate
/pipe (rev ~~ test ~~ sec ~~ a11y) ?>> ship

# Full workflow with safety nets
/pipe try (
  @before:rules @after:test go *5 >>
  assert files.max_lines <= 100 >>
  assert $test.coverage >= 90 >>
  approve "Ship?" >> ship
) catch (rollback >> fix >> test) finally (docs >> changelog)

# Named workflows
/pipe def qg = (rev ~~ test ~~ sec)
/pipe go *5 >> run qg ?>> pr !>> (fix >> test) *3?

# AI-powered
/pipe search "auth" >> nexa review >> lam "improve auth" >> test >> pr

# Multi-repo deploy
/pipe in lunaos-engine (test >> ship) ~~ in lunaos-dashboard (test >> ship)

# Watch mode
/pipe watch src/ >> test >> rev
```

## Tips

- `/feature` is the autopilot — plan, implement, test, fix in a loop
- `/go` runs one task at a time — repeat until all tasks are `[x]`
- `/parallel build,test,lint` — run multiple checks simultaneously
- `/fix "bug description"` — systematic fix with failing test first
- `/rules` at session start — enforces 100-line cap + full tests
- `/search "how does X work?"` — multi-engine code search
- `/nexa review src/` — AI code analysis with Nexa
- `/lam "add feature X"` — autonomous goal-driven implementation
- `/chain "rag -> nexa -> fix"` — compose agent pipelines
- `/cmds` — show this cheat sheet anytime
