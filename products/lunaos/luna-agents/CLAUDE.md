# CLAUDE.md - Luna Agents (CLI and Plugin)

This file extends the workspace root policy at:

- `/Users/shaharsolomon/dev/projects/claude.md`

## Product Mission And Target User

- Mission: Provide a CLI toolkit and Claude Code plugin that enables developers to orchestrate AI agents, run development lifecycle commands, and interact with LunaOS services directly from the terminal and editor.
- Target user: Developers using Claude Code who want agent orchestration, semantic search (RAG), vision-based analysis, and automated development workflows from the command line.
- Primary jobs to be done:
  - Execute 100+ slash commands for development lifecycle management (plan, design, test, deploy, review)
  - Provide MCP servers for RAG semantic search, GLM vision analysis, and vision-RAG integration
  - Orchestrate multi-agent pipelines (chain, swarm, parallel execution)
  - Manage project setup, configuration, and plugin installation

## Product-Specific Architecture Constraints

- Runtime(s): Node.js >= 18; published as npm package `luna-agents`; workspaces for plugin and MCP servers
- Core services:
  - `.claude-plugin/` -- Claude Code plugin entry point and slash command definitions
  - `cli/` -- standalone CLI with Commander.js; entry at `cli/src/`
  - `cli/src/sec/` -- DevSecOps lifecycle handlers (orchestrator + tool runners + bundles + lifecycle installer). Wraps gitleaks, trufflehog, semgrep, osv-scanner, license-checker, checkov, tfsec, trivy, hadolint, dockle, syft, grype, cosign, nuclei, ZAP, jazzer.js, atheris, threagile.
  - `templates/sec-lifecycle/` -- husky hooks + GitHub Actions workflows + dependabot config copied by `luna sec lifecycle install`
  - `mcp-servers/luna-nexa-rag/` -- RAG semantic search MCP server
  - `mcp-servers/luna-glm-vision/` -- GLM vision analysis MCP server
  - `mcp-servers/luna-vision-rag-client/` -- combined vision+RAG MCP client
  - `packages/rag/` -- shared RAG library
  - `agents/` -- agent type definitions and registry
  - `commands/` -- slash command implementations
- Data boundaries: Plugin reads/writes local `.luna/` project directories; MCP servers communicate over stdio; no direct database access
- Integration boundaries: Claude Code plugin API, MCP protocol (stdio transport), engine API (for remote agent execution), GitHub (repo analysis)

### npm Package and MCP-Specific Constraints

- All MCP servers must implement the MCP protocol with stdio transport
- MCP tool definitions must include complete JSON Schema for parameters
- CLI commands must have `--help` output and follow POSIX conventions
- Plugin slash commands must be registered in `.claude-plugin/index.js`
- All agent definitions must include typed input/output schemas
- Setup scripts must be idempotent (safe to run multiple times)
- Max 200 lines per command file; split complex agents into separate modules

## Product-Specific Test Matrix

- Unit tests: Jest; plugin tests at `.claude-plugin/` via `npm run test:plugin`; MCP tests at `mcp-servers/luna-nexa-rag/` via `npm run test:mcp`; CLI tests at `cli/tests/`
- Integration tests: Test MCP server stdin/stdout communication; test CLI command execution with stubbed API
- E2E/smoke tests: Test full `luna-setup` installation flow; test plugin activation in Claude Code environment
- Critical path tests (must remain 100% covered):
  - MCP server tool registration and invocation
  - RAG document indexing and search
  - CLI authentication and API key management
  - Plugin slash command routing
- Coverage thresholds: >=90% line, >=85% branch (matches root policy)

## Product-Specific Security Controls

- AuthN/AuthZ model: API keys stored via OS keychain or `.env` files (never committed); MCP servers inherit parent process permissions
- Secret management: No secrets hardcoded; `.env.example` files provided; setup scripts prompt for keys interactively
- Input/output validation: Zod validation on all MCP tool parameters; CLI argument validation via Commander.js; file path sanitization for local operations
- Audit logging requirements: Agent execution results logged locally to `.luna/` directory; no remote telemetry without user opt-in
- Data retention/privacy constraints: Local RAG indexes stored in user project directory; no data sent to remote servers unless user explicitly triggers remote execution

## Product-Specific Release Checklist

- [ ] CI is green (plugin + MCP + CLI tests pass)
- [ ] Coverage thresholds met: >=90% line, >=85% branch
- [ ] Security scans have no open Critical/High issues
- [ ] `npm pack` produces clean tarball with correct files
- [ ] All MCP servers respond to `initialize` handshake
- [ ] CLI `--help` output accurate for all commands
- [ ] setup.sh is idempotent (tested with fresh and existing installs)
- [ ] Rollback path verified (previous npm version tagged)
- [ ] CHANGELOG.md updated with version notes
- [ ] README.md installation instructions tested on clean machine

## Commands

```bash
npm run setup             # Full setup (install deps, configure MCP)
npm run dev               # Dev mode (MCP server + plugin watch)
npm run test              # All tests (plugin + MCP)
npm run test:plugin       # Plugin tests only
npm run test:mcp          # MCP server tests only
npm run install:all       # Install all workspace dependencies
npm run start:mcp         # Start MCP server
```

## Security Lifecycle (DevSecOps)

| Phase | Subcommand | Wraps |
|-------|------------|-------|
| Pre-commit | `luna sec precommit` | gitleaks (staged) |
| PR / push | `luna sec pr` | gitleaks + trufflehog + semgrep + osv-scanner + license-checker |
| Build | `luna sec build --artifact <img>` | syft (SBOM) + grype + cosign sign |
| Pre-deploy | `luna sec deploy --image <img>` | trivy + hadolint + dockle + checkov + tfsec |
| Runtime DAST | `luna sec runtime --target-url <u>` | nuclei + ZAP baseline |
| Continuous | `luna sec watch` | osv-scanner + iac drift + DAST baseline |
| Umbrella | `luna sec push --mode {fast,full,ci}` | full sweep |
| Lifecycle install | `luna sec lifecycle --action install` | wires husky + GHA + dependabot |
| Aggregate report | `luna sec report` | rolls all summaries into SUMMARY.md |

Each subcommand respects `.luna/{project}/security/config.yaml` and `LUNA_SEC_BYPASS=1` (audited). Default severity gate blocks Critical/High; override with `--strict false`. Full docs: `lunaos-docs/docs/security/lifecycle.md`.

## Local Notes

- This file adds MCP protocol compliance requirement (stricter than root).
- This file adds npm package hygiene checks (pack, idempotent setup).
- This file does not weaken any root policy requirement.
- Published as npm package; CLI entry via `luna-setup` bin script.
