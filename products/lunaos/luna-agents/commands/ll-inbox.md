---
name: ll-inbox
displayName: Luna Inbox Zero
description: AI email management — auto-categorize, bulk unsubscribe, draft replies, meeting briefs, and inbox analytics
version: 1.0.0
category: productivity
agent: luna-task-executor
parameters:
  - name: action
    type: string
    description: "Action: clean (bulk unsubscribe), draft (auto-reply drafts), brief (meeting prep), analyze (inbox stats), triage (categorize)"
    required: true
    prompt: true
  - name: account
    type: string
    description: Email account (Gmail, Outlook)
    required: false
    default: default
prerequisites:
  - Gmail or Outlook OAuth configured
---

# Luna Inbox Zero — AI Email Management

Manage your inbox with AI — categorize emails, bulk unsubscribe, draft replies, prepare meeting briefs, and get inbox analytics.

## What This Command Does

1. **Triage** — Categorize unread emails: action-required, FYI, newsletter, spam, meeting
2. **Clean** — Bulk unsubscribe from newsletters and marketing in one command
3. **Draft** — AI pre-drafts replies for action-required emails
4. **Brief** — Prepare meeting briefs from calendar + related email threads
5. **Analyze** — Inbox analytics: volume, response time, top senders, busiest hours

## Usage

```bash
# Categorize inbox
/inbox triage

# Bulk unsubscribe from newsletters
/inbox clean

# Draft replies for important emails
/inbox draft

# Prepare briefs for today's meetings
/inbox brief

# Inbox analytics
/inbox analyze
```

## How It Works

### Triage
- Connects to Gmail/Outlook via OAuth
- Reads unread emails (subject + first 200 chars)
- Sends to Claw Gateway AI for categorization
- Labels emails: action-required, FYI, newsletter, meeting, spam
- Outputs prioritized list

### Clean
- Identifies all newsletter/marketing senders
- Shows list with unsubscribe counts
- Bulk unsubscribes (one-click via List-Unsubscribe header)
- Archives old newsletters

### Draft
- Takes action-required emails
- AI generates draft replies based on context
- Saves as drafts (doesn't send)
- You review and send

### Brief
- Reads today's calendar events
- Finds related email threads per meeting
- AI generates a 3-bullet brief per meeting
- Includes: attendees, context, suggested talking points

### Analyze
- Inbox volume over time
- Average response time
- Top 10 senders
- Busiest hours/days
- Unread count trend

## Output

```
.luna/{project}/inbox/
  triage.md         # Categorized email list
  unsubscribe.md    # Newsletter cleanup report
  drafts/           # AI-drafted replies
  briefs/           # Meeting preparation briefs
  analytics.md      # Inbox stats
```

## Privacy

- Emails processed via Claw Gateway AI (your own infrastructure)
- No data sent to third parties
- Self-hostable with Inbox Zero open-source (github.com/elie222/inbox-zero)
- OAuth tokens encrypted at rest

## In Pipes

```bash
# Morning routine: triage, brief, draft
/pipe inbox triage >> inbox brief >> inbox draft

# Weekly cleanup
/pipe inbox clean >> inbox analyze
```

Reference: [Inbox Zero](https://github.com/elie222/inbox-zero)
