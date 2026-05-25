# AI Engine, Streaming & Export Tests

> 17 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Anthropic API key configured (or OpenClaw connected)

## Tests

### AI Engine (from main suite section 12)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Chat tab | Go to /ai | Chat interface with suggested prompts | |
| 2 | Send message | Type "What are my top security risks?", press Send | AI response referencing real tenant data | |
| 3 | Security Scan tab | Switch to Security Scan, click "Run Scan" | Risk score, findings, recommendations | |
| 4 | License Optimize tab | Switch to License Optimize, click "Optimize" | Wasted licenses, savings, action items | |
| 5 | Analysis Chain tab | Switch to Analysis Chain | Preset dropdown + "Run Chain" button | |
| 6 | Run chain | Select "Full Assessment", click "Run Chain" | Analysis output (or error if no API key) | |
| 7 | Export | Click Export > JSON | Downloads AI analysis results | |
| 8 | Status badge | Check header | Shows "Anthropic fallback" or "OpenClaw connected" | |

### AI Chat Streaming (from main suite section 42)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 9 | Chat interface | Navigate to /ai | Chat interface loads with input field and suggested prompts | |
| 10 | Send message | Type a security question and press Send | Message appears in chat, loading indicator shown | |
| 11 | Streaming response | Watch AI response | Text appears incrementally (character or chunk at a time), not all at once | |
| 12 | Tool execution | Observe tool calls during response | Tool execution cards appear showing tool name, status, and result summary | |
| 13 | Suggested actions | After response completes | Suggested action buttons appear below the AI response | |

### Conversation Export (from main suite section 43)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 14 | Open conversation | In /ai, have a conversation with at least one exchange | Conversation visible with user and AI messages | |
| 15 | Export Markdown | Click Export > Markdown | Downloads conversation as .md file with formatted messages | |
| 16 | Export JSON | Click Export > JSON | Downloads conversation as .json file with structured message data | |
| 17 | Share link | Click "Share" button | Shareable link generated and copied to clipboard; toast confirms | |
