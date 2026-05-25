# Changelog

All notable changes to PushCI are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- `keychain://` secret-ref scheme — pulls values from the OS-native keystore (macOS Keychain via `security`, Windows Credential Manager via `wincred`, Linux Secret Service via libsecret) with transparent fallback to an AES-encrypted file at `~/.pushci/keychain.enc` when no daemon is available (typical headless Linux CI).
- `pushci secrets keychain {set,get,list,rm,rotate}` — manage entries from the CLI. Round-trip-compatible with the standard `security` CLI on macOS (no `go-keyring-base64:` prefix), so the same entry works with the common `.zshrc secret` / `secret-set` helpers and with pushci.
- `pushci secrets keychain rotate <name> <new>` — swap a value and print the old value's first-8-char prefix so you have something to paste into the provider's revoke screen. Reads from stdin via `--from-stdin` or from `PUSHCI_NEW_SECRET` when no positional value is given.
- `pushci.yml` `env:` values now accept `keychain://<service>[#<account>]` alongside the existing `vault://path#field` scheme. Account defaults to the current OS user when `#account` is omitted.
- README "Secrets" section documenting all three secret-ref schemes (`keychain://`, `vault://`, local AES store) and the Linux-CI fallback semantics.

### Changed
- `runner.ResolveEnv` signature extended to accept both a vault and a keychain resolver. Internal API only — `pushci.yml` users are unaffected.

### Added
- `pushci voice` — persona-driven TTS narration for pipeline runs (`list` / `say` / `test` / `joke` / `listen` / `install`)
- Four built-in personas: `curb-style`, `office-style`, `deadpan-tech`, `deadpan-narrator`
- Community persona marketplace via `~/.pushci/voices.yml` and `pushci voice install <https-url>`
- `pushci voice listen` — STT trigger via Groq Whisper
- AI commentary opt-in via `--ai` flag or `PUSHCI_VOICE_AI=1` — fresh in-character lines per event using any of the 7 configured AI providers
- `pushci voice joke --diff <ref>` — AI riffs on your recent diff via redacted `git diff --stat` summary
- Failure-roast auto-AI joke on run failure
- Redaction layer scrubbing JWTs, ARNs, API keys, account IDs, IPs, internal hostnames, emails before any utterance reaches a TTS backend or stdout
- AI output safety filter rejecting profanity and prompt-injection echo (silent fallback to canned phrases)
- GitLab `!reference [.anchor, key]` expansion in `internal/migrate/gitlab.go` — recovers jobs that were silently dropped on multi-line scripts (vala-gate dogfood)
- Permissive types on GitLab `image` / `only` / `except` / `needs` — fixes scan/promote/sonar jobs that used mapping-form `image:` blocks
- Deploy-target inference from migrated CI script content (33 patterns: ECS, EKS, Lambda, Helm, K8s, Wrangler, Vercel, Fly, gcloud, Terraform, etc.)
- Interactive multi-project picker in `pushci init` for monorepos with >1 detected stack
- Migration warning surfacing — empty-job and `include:` template detection with actionable hints
- Terraform `var.X` interpolation resolver against co-located `*.tfvars` files (telia/teddk dogfood)
- Vault AppRole adapter + `vault://` env resolver for HashiCorp Vault secrets
- Fleet report script for multi-repo `pushci init` dry-run across org fleets
- Azure Functions deploy driver
- ASP.NET Core / Blazor framework detection
- Bicep deploy driver for Azure ARM IaC
- Render deploy driver via Deploy Hook API
- `pushci import actions` / `import-from-actions` — convert GitHub Actions workflows (closes #21)
- `pushci deploy` one-command UX for Vercel / Cloudflare / Fly (closes #22)
- GHA-bill savings calculator + Curb-voice eyebrow on landing (closes #20)
- Three new `/vs/` competitor pages: `/vs/bitbucket-pipelines`, `/vs/azure-pipelines`, `/vs/aws-codepipeline` (closes #29)
- Parallel CI jobs for `mobile/`, `api/`, `agent-platform/` subtrees (closes #19)
- `.luna/pushci/no-bluf-report.md` — anti-bluff audit + grounded roadmap rewrite

### Fixed
- Sub-directory `buildspec.yml` no longer pre-empts root `.gitlab-ci.yml` migration
- Go toolchain pinned to 1.26.3 — closes GO-2026-4971 (`net.Dial`/`LookupPort` panic) and GO-2026-4918 (HTTP/2 infinite loop)
- Vault token race condition in secrets resolver
- Heuristic merge allowed when GitHub Actions migration produces empty output
- `env_test.go` gofmt formatting
- Stale `push-ci.dev` refs swept to `pushci` (closes #17)
- Sitemap drops three unrouted `/vs/*` URLs that returned the SPA NotFound page (commit `e635e066`)
- Fabricated `aggregateRating: 4.9 / 127` removed from landing JSON-LD — anti-bluff cleanup (commit `de8d7df2`)
- Homebrew tap bumped to align with goreleaser-built sha256s

### Security
- `PUSHCI_VOICE_OFF=1` mute env var honored by every Speaker backend
- Personas rebranded from real-celebrity names to style-based names (`larry-david` → `curb-style`, `michael-scott` → `office-style`, `gilfoyle` → `deadpan-tech`); old names still resolve via alias map
- Leaked `.mcpregistry_*` tokens removed and disclosure documented in `SECURITY.md` (closes #18)

## [1.7.4] - 2026-04-28

### Added
- Norlys pilot page with capability truth pass + noindex headers
- X-Robots-Tag noindex for `/norlys-pilot`
- D1 control plane pinned to EU-West for Norlys pilot
- SCIM v2 alias mounted at `/api/scim/v2`

### Fixed
- Lockfile sync to v1.7.4

## [1.7.3] - 2026-04-27

### Added
- `pushci extend` command: AI-edit pushci.yml via natural language
- Anti-bluff drill round 1 guardrails in CLAUDE.md

## [1.7.2] - 2026-04-26

### Added
- Working contact form + enterprise terminal demo
- Achievements page in dashboard
- Pricing alignment across all surfaces
- Dashboard overview page with show-command on failed checks

### Fixed
- Wire unrouted pages, sanitize error messages
- Mobile responsive layouts
- SAML + SCIM refactored under 200-line cap

### Security
- Added gitleaks + go-licenses + coverage gate to CI pipeline
- Tightened security headers on landing site
