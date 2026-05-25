# OpenClaw Integration Tests

> 8 tests | Priority: P2

## Prerequisites
- Signed in as admin user
- OpenClaw integration available

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Page loads | Go to /integrations/openclaw | Header with "OpenClaw Integration" title and install status badge (green or red) | |
| 2 | Tab navigation | Click each tab | 5 tabs: Overview, Skills & Commands, Channels, Webhooks, Installation Guide | |
| 3 | Overview tab | View Overview tab | Stats (command count, connected channels, webhook status), setup checklist | |
| 4 | Skills tab | Click "Skills & Commands" | Command categories listed with counts (Security, License Optimization, etc.) | |
| 5 | Channels tab | Click "Channels" | 6 platform cards (Slack, Teams, Discord, WhatsApp, Telegram, iMessage) with Connect/Disconnect buttons | |
| 6 | Connect platform | Click "Connect" on a platform card | Platform status changes to connected | |
| 7 | Webhooks tab | Click "Webhooks" | Webhook URL input, secret, notification mode, severity filter, category toggles, quiet hours | |
| 8 | Install guide | Click "Installation Guide" | Step-by-step installation instructions with copy command button | |
