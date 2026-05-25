# 🔍 Code Review Agent

<Badge type="tip" text="Free" />

Expert code reviewer that identifies bugs, security vulnerabilities, performance issues, and code quality improvements.

## When to Use

- Before merging a PR
- Auditing legacy code
- Checking for security issues
- Reviewing architecture decisions

## Capabilities

- **Security analysis** — SQL injection, XSS, CSRF, auth bypass
- **Performance review** — N+1 queries, memory leaks, unnecessary re-renders
- **Code quality** — DRY violations, naming conventions, complexity
- **Best practices** — Error handling, type safety, accessibility

## CLI Usage

```bash
# Review a file
luna run code-review --context "$(cat src/auth.ts)"

# Review a git diff
luna run code-review --context "$(git diff HEAD~1)"

# Review a specific function
luna run code-review --context "
function processPayment(amount, currency) {
  const query = 'INSERT INTO payments VALUES (' + amount + ')';
  db.execute(query);
  return { success: true };
}
"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "code-review",
    "context": "your code here"
  }'
```

## Example Output

```markdown
## Code Review Results

### 🔴 Critical Issues

#### SQL Injection Vulnerability (Line 2)
String concatenation in SQL query allows injection attacks.
**Severity**: Critical
**Fix**:
```javascript
const query = 'INSERT INTO payments VALUES (?)';
db.execute(query, [amount]);
```

### 🟡 Warnings

#### Missing Input Validation
The `amount` parameter is not validated. Could be negative or non-numeric.
**Fix**: Add Zod schema validation.

#### Missing Error Handling
No try/catch around database operations.

### 🟢 Suggestions

- Add TypeScript types for parameters
- Return proper error codes (not just `{ success: true }`)
- Add logging for payment events

---
📊 3 issues found | 1 critical | 1 warning | 1 suggestion
```

## Best Practices

- **Provide context** — the more code you provide, the better the review
- **Include file paths** — helps the agent understand the project structure
- **Combine with RAG** — index your codebase first for project-aware reviews
