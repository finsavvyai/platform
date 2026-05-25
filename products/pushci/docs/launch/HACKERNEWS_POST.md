# Hacker News Submission

## Title
Show HN: PushCI – AI-native CI/CD that replaces GitHub Actions in 30 seconds

## URL
https://pushci.dev

## Text (for Show HN comment)
I built PushCI because writing YAML to run `npm test` felt absurd.

PushCI uses AI to auto-detect your stack (19 languages, 40+ frameworks) and generate a complete CI/CD pipeline with zero configuration. It runs on your local machine for free — no cloud compute costs.

Key differences from GitHub Actions:
- Setup: 30 seconds vs 30+ minutes
- Cost: $0 vs $0.008/min
- Config: AI auto-detect vs manual YAML
- Platforms: GitHub + GitLab + Bitbucket vs GitHub-only

It also has an MCP server so AI coding agents (Claude Code, Cursor, Windsurf) can set up CI/CD directly.

Try it: `npx pushci init`

Tech: Go CLI, Cloudflare Workers API, React dashboard, Claude AI for pipeline generation.

https://github.com/finsavvyai/pushci
