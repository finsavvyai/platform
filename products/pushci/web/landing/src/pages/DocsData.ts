export interface DocSection {
  id: string
  title: string
  content: string
}

export const coreSections: DocSection[] = [
  {
    id: 'quick-start',
    title: 'Quick Start',
    content: `npx pushci init      # Auto-detect stack, language, framework
pushci run           # Run your pipeline locally
pushci deploy        # Deploy to any target`,
  },
  {
    id: 'installation',
    title: 'Installation',
    content: `# npm (recommended — bundled binaries, no network fetch)
npm i -g pushci

# Homebrew
brew tap finsavvyai/tap && brew install pushci

# curl (any POSIX shell)
curl -fsSL https://pushci.dev/install.sh | sh

# npx (no install needed)
npx pushci init`,
  },
  {
    id: 'commands',
    title: 'CLI Commands',
    content: `pushci init            Detect stack and generate pushci.yml
pushci run             Execute pipeline checks
pushci deploy          Deploy to target environment
pushci diagnose        AI-diagnose failed runs
pushci status          Show last run results
pushci secret          Manage encrypted secrets
pushci heal            AI self-heal broken pipeline
pushci ask             Natural language CI commands
pushci generate        AI-generate pushci.yml
pushci migrate         Convert GitHub Actions workflow
pushci mcp             Start MCP server for AI agents
pushci agent           Start webhook agent server
pushci index           Build dependency graph
pushci skill           Install/list/remove skills
pushci login           Authenticate with PushCI (Pro)
pushci logout          Remove saved credentials
pushci doctor          Check environment health
pushci troubleshoot    Diagnose issues with fixes
pushci trace           View Perfetto performance traces
pushci release         Build & publish release ($0)
pushci promote         Register with AI registries
pushci uninstall       Remove hooks, config, .pushci
pushci version         Print version`,
  },
  {
    id: 'configuration',
    title: 'Configuration',
    content: `# pushci.yml (optional — zero config works too)
name: my-app
language: typescript
framework: nextjs

steps:
  - name: Install
    run: npm ci
  - name: Lint
    run: npm run lint
  - name: Test
    run: npm test -- --coverage
  - name: Build
    run: npm run build

deploy:
  target: cloudflare-pages
  branch: main

notifications:
  slack: "#ci-alerts"`,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    content: `# Slack
pushci channel add slack --webhook https://hooks.slack.com/...

# Discord
pushci channel add discord --webhook https://discord.com/api/webhooks/...

# Email
pushci channel add email --to team@example.com

# Telegram
pushci channel add telegram --bot-token BOT_TOKEN --chat-id CHAT_ID

# Generic Webhook
pushci channel add webhook --url https://example.com/ci-hook`,
  },
]