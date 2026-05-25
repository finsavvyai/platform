# Configuration

Customize your LunaOS setup for your workflow.

## CLI Configuration

The CLI stores configuration at `~/.luna/config.json`:

```json
{
  "token": "eyJhbG...",
  "apiUrl": "https://api.lunaos.ai",
  "defaultProvider": "deepseek",
  "defaultModel": "deepseek-chat"
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LUNAOS_API_KEY` | API key for authentication | — |
| `LUNAOS_API_URL` | API base URL | `https://api.lunaos.ai` |
| `LUNAOS_PROVIDER` | Default LLM provider | `deepseek` |
| `LUNAOS_MODEL` | Default model | `deepseek-chat` |

```bash
# Set via environment variables
export LUNAOS_API_KEY="lnos_live_..."
export LUNAOS_PROVIDER="anthropic"
```

## LLM Providers

### Default: DeepSeek

```bash
luna run code-review --context "..." --provider deepseek
```

- Model: `deepseek-chat` (default), `deepseek-reasoner` (R1)
- Best for: Fast, cost-effective analysis

### Anthropic (Claude)

```bash
luna run code-review --context "..." --provider anthropic
```

- Model: `claude-sonnet-4-20250514`
- Best for: Complex reasoning, nuanced analysis

### OpenAI (GPT-4o)

```bash
luna run code-review --context "..." --provider openai
```

- Models: `gpt-4o`, `gpt-4o-mini`
- Best for: General purpose, broad knowledge

## API Key Management

### Generate a Key

```bash
luna keys create --name "ci-pipeline"
# → lnos_live_a1b2c3d4e5f6g7h8...
# ⚠️ Save this — it won't be shown again!
```

### List Keys

```bash
luna keys list
# NAME            PREFIX              LAST USED
# ci-pipeline     lnos_live_a1b2...   2 hours ago
# local-dev       lnos_live_x9y8...   never
```

### Revoke a Key

```bash
luna keys revoke ci-pipeline
```

## CI/CD Integration

### GitHub Actions

```yaml
name: LunaOS Code Review
on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Get changed files
        id: changed
        run: echo "files=$(git diff --name-only ${{ github.event.pull_request.base.sha }} | tr '\n' ' ')" >> $GITHUB_OUTPUT
      - name: Run Code Review
        run: |
          for f in ${{ steps.changed.outputs.files }}; do
            echo "Reviewing: $f"
            curl -s -X POST https://api.lunaos.ai/agents/execute \
              -H "Authorization: Bearer ${{ secrets.LUNAOS_API_KEY }}" \
              -H "Content-Type: application/json" \
              -d "{\"agent\": \"code-review\", \"context\": \"$(cat $f | jq -Rs .)\"}"
          done
```

### GitLab CI

```yaml
lunaos-review:
  stage: review
  script:
    - |
      for f in $(git diff --name-only $CI_MERGE_REQUEST_DIFF_BASE_SHA); do
        curl -s -X POST https://api.lunaos.ai/agents/execute \
          -H "Authorization: Bearer $LUNAOS_API_KEY" \
          -H "Content-Type: application/json" \
          -d "{\"agent\": \"code-review\", \"context\": \"$(cat $f | jq -Rs .)\"}"
      done
```
