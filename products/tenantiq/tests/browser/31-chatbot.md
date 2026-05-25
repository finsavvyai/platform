# AI Guide Chatbot Tests

> 8 tests | Priority: P1

## Prerequisites
- Signed in as any user role
- Chatbot bubble visible on page

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Chat bubble visible | Check bottom-right corner on any page | Floating circular chat button (56px) | |
| 2 | Opens on click | Click the chat bubble | Panel opens (380x500px) with "TenantIQ Guide" header | |
| 3 | Free badge shown | Check chat panel header | "Free" badge visible | |
| 4 | Basic question works | Type "What is TenantIQ?" and send | Bot responds with product description | |
| 5 | Navigation question | Type "Show me security" | Response includes link to /security page | |
| 6 | Feature question | Type "How do I run a scan?" | Response explains CIS scan process with navigation | |
| 7 | Unknown question fallback | Type a complex/random question | Response: "For advanced AI analysis, use the AI Agent page" with upgrade link | |
| 8 | Close button works | Click X on chat panel | Panel closes, bubble remains | |
