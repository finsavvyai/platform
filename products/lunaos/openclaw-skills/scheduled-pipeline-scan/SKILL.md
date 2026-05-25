---
name: scheduled-pipeline-scan
description: Automated cron-scheduled PipeWarden security scans with Slack notifications for critical findings and mobile push alerts
homepage: https://agents.lunaos.ai
---

# Scheduled Pipeline Scan

Automate security scanning of your CI/CD pipelines on a schedule (daily, weekly, or custom cron) and receive Slack notifications and mobile push alerts when critical security issues are found.

## How to use

### 1. Install the Skill

This skill runs automatically on your configured schedule. Configure it via LunaOS dashboard or the API:

```bash
curl -X POST https://api.lunaos.ai/skills/install \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "scheduled-pipeline-scan",
    "schedule": "0 9 * * MON-FRI",
    "timezone": "America/New_York"
  }'
```

### 2. Configure Environment Variables

Set these in your LunaOS environment or `.env`:

- `PIPEWARDEN_API_URL`: PipeWarden server URL (default: http://localhost:8080)
- `PIPEWARDEN_API_KEY`: API key for PipeWarden authentication
- `SLACK_WEBHOOK_URL`: Incoming webhook for Slack notifications
- `SLACK_BOT_TOKEN`: Bot token for mobile push notifications (optional)
- `CRITICAL_THRESHOLD`: Minimum number of critical findings to trigger alerts (default: 3)
- `ENABLE_MOBILE_PUSH`: Enable iOS/Android push notifications (default: true)

### 3. Slack Integration

The skill sends two types of Slack messages:

**Summary Report** (always):
- Risk score for each connected pipeline
- Count of findings by severity
- Link to full report in PipeWarden dashboard

**Critical Alert** (when threshold exceeded):
- List of critical findings
- Affected pipeline names
- Remediation recommendations
- One-click deep link to PipeWarden

### 4. Mobile Push Notifications

When `ENABLE_MOBILE_PUSH=true`:
- Critical findings trigger push notifications to Slack app on iOS/Android
- Notifications include finding title and severity
- Tap notification to open PipeWarden dashboard

### 5. Notification Customization

Modify how notifications are formatted:

```json
{
  "notification_level": "critical",
  "include_metrics": true,
  "include_trends": true,
  "include_remediation": true,
  "group_by_pipeline": true
}
```

## When to use

- Enforce daily/weekly security scanning across CI/CD platforms
- Alert your team to critical pipeline vulnerabilities
- Maintain compliance with security audits
- Track pipeline security trends over time
- Integrate with incident response workflows

## Integration with PipeWarden

This skill connects to PipeWarden to:
1. List all connected pipelines (GitHub Actions, GitLab CI/CD, Bitbucket, Jenkins, Azure DevOps, CircleCI)
2. Trigger security scans (heuristic + Claude AI analysis)
3. Fetch detailed findings with remediation suggestions
4. Export findings as SARIF for GitHub Security tab

## Scheduling Options

Use standard 5-field cron syntax:

```
# Run at 9 AM UTC every weekday
0 9 * * 1-5

# Run at 6 PM every day
0 18 * * *

# Run every 6 hours
0 */6 * * *

# Run every Monday at 8 AM
0 8 * * 1
```

## Example: Enterprise Setup

```bash
# Install skill with custom schedule
curl -X POST https://api.lunaos.ai/skills/install \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -d '{
    "skill": "scheduled-pipeline-scan",
    "schedule": "0 8 * * 1-5",
    "timezone": "US/Eastern",
    "config": {
      "CRITICAL_THRESHOLD": "1",
      "ENABLE_MOBILE_PUSH": "true",
      "group_by_pipeline": true
    }
  }'
```

This will:
- Scan pipelines at 8 AM EST on weekdays
- Alert on any critical findings (threshold=1)
- Send mobile push notifications
- Group results by pipeline in Slack

## Troubleshooting

### Notifications not arriving
1. Verify `SLACK_WEBHOOK_URL` is valid
2. Check `SLACK_BOT_TOKEN` for push notifications
3. Ensure Slack workspace has bot permissions

### Scans not running
1. Confirm skill is enabled: `curl https://api.lunaos.ai/skills/status`
2. Check cron schedule in LunaOS dashboard
3. Verify `PIPEWARDEN_API_KEY` and `PIPEWARDEN_API_URL` are correct

### Mobile push not working
1. Ensure Slack app is installed on mobile device
2. Check `ENABLE_MOBILE_PUSH=true` in config
3. Verify bot has notification permissions

## Related Skills

- **luna-code-review**: Deep code analysis with security focus
- **luna-security-audit**: Manual security audits with detailed reporting

## Support

For issues or feature requests, open an issue on the OpenClaw repository.
