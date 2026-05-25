# Phishing Analysis Tests

> 6 tests | Priority: P2

## Prerequisites
- Signed in as admin user
- Email security data available

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Overview cards | Go to /phishing | 4 overview cards: Threat Level, Phishing Score, Active Threats, Protection Gaps | |
| 2 | Threat level badge | Check Threat Level card | Shows level (LOW/MEDIUM/HIGH/CRITICAL) with color-coded badge | |
| 3 | Threat cards | Check Active Threats section | Threat cards with type, subject, sender, confidence %, and indicator tags | |
| 4 | Threat detail modal | Click a threat card | Modal with full details: type, subject, sender, received time, confidence, all indicators, Quarantine/Report buttons | |
| 5 | Protection gaps | Check Protection Gaps section | Gap cards with severity badge and description | |
| 6 | Scan now | Click "Scan Now" | Spinner during scan, then refreshed results | |
