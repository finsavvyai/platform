# Changelog

## 0.2.0 — 2026-03-16

### Added
- **File write monitoring** — Detects when agents save to sensitive files (.env, auth modules, CI workflows)
- **Write-specific risk classification** — Auth middleware, GitHub Actions, and Makefile writes flagged as HIGH risk
- **Shared risk classifier** — Unified classification logic for both reads and writes
- Cloud sync endpoint support for team dashboard integration

### Changed
- Risk classifier extracted to standalone module for better testability
- Activity logger now supports `file_write` event type

## 0.1.0 — 2026-03-10

### Added
- Real-time file access monitoring with 4-level risk classification
- Terminal command interception for dangerous shell operations
- Secret pattern detection (AWS, GitHub, Stripe, OpenAI, SSH keys)
- Per-agent activity breakdown (Cursor, Cline, Claude Code, Copilot, Devin)
- Security risk score (0-100) with contextual narrative
- One-click HTML report with LinkedIn share card
- Sidebar panel with live activity feed
- Critical event notifications
- Optional cloud sync to OpenSyber dashboard
- Local-only storage at ~/.opensyber/activity.jsonl
