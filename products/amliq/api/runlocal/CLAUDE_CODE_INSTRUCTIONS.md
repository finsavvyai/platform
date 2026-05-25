# PushCI — Claude Code Instructions

## Session Setup

When starting a new Claude Code session on PushCI:

1. Read `CLAUDE.md` for product overview
2. Read `CLAUDE_DETAILS.md` for all packages + commands
3. Read `ROADMAP.md` for what's built vs planned
4. Run `go build ./... && go test ./...` to verify state

## Repository Location

PushCI lives at `/home/user/amliq/runlocal/` inside the AMLIQ repo.
It has its own `go.mod` (module: github.com/finsavvyai/pushci).

To work on PushCI: `cd runlocal/`
To work on AMLIQ: stay in repo root.

## Build Commands

```bash
# Go CLI
cd runlocal && go build -o pushci ./cmd/pushci

# Landing page
cd runlocal/web/landing && npm install && npm run dev

# Dashboard
cd runlocal/web/dashboard && npm install && npm run dev

# API (Cloudflare Workers)
cd runlocal/api && npm install && npx wrangler dev

# Run all tests
cd runlocal && go test ./...

# Build everything
cd runlocal && make build
```

## Code Rules (MUST FOLLOW)

1. **Every file ≤100 lines** — split if approaching limit
2. **Table-driven Go tests** — `tests := []struct{...}`
3. **No external UI libs** — pure Tailwind CSS
4. **Dark theme** — zinc-950 bg, emerald-500 accent
5. **No mocks in production** — label sample data clearly
6. **Secrets via env vars** — never hardcode tokens/keys
7. **Module path**: `github.com/finsavvyai/pushci`

## Adding a New Feature

### New Go Package
1. Create `internal/myfeature/myfeature.go` (≤100 lines)
2. Create `internal/myfeature/myfeature_test.go` (table-driven)
3. Run `go build ./... && go test ./...`

### New CLI Command
1. Create `cmd/pushci/cmd_mycommand.go` (≤100 lines)
2. Add case to `cmd/pushci/main.go` switch + usage
3. Use `internal/cli` for colored output

### New API Endpoint
1. Create `api/src/myfeature.ts` (≤100 lines)
2. Import + register in `api/src/index.ts`
3. Add auth middleware if needed

### New Dashboard Page
1. Create `web/dashboard/src/pages/MyPage.tsx` (≤100 lines)
2. Add route in `web/dashboard/src/App.tsx`
3. Add nav item in `web/dashboard/src/components/Sidebar.tsx`

### New Landing Page Section
1. Create `web/landing/src/components/MySection.tsx` (≤100 lines)
2. Import in `web/landing/src/App.tsx`

## Key Architecture Decisions

- **CLI is Go** — cross-compiles to all platforms
- **API is Cloudflare Workers** — free tier, global edge
- **Database is D1** — SQLite on Cloudflare, free
- **AI uses Claude Haiku** — fast + cheap ($0.001/call)
- **Billing is Stripe** — checkout + portal + webhooks
- **Auth is GitHub/GitLab OAuth** — JWT tokens
- **MCP server** — AI agents can use PushCI as a tool
- **Secrets use AES-256-GCM** — machine-bound key

## Deploy

```bash
# Cloudflare Pages (landing + dashboard)
./deploy-cloudflare.sh

# Cloudflare Workers (API)
cd api && npx wrangler deploy

# npm publish
npm publish
```

## Git Workflow

- Branch: `claude/prepare-sprint-release-jRqtY`
- Always push to specified branch, not main directly
- Commit messages: conventional commits (feat/fix/docs)
- Pre-commit hook: format + 100-line check + build
- Pre-push hook: full test suite
