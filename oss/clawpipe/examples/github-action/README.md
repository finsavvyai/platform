# ClawPipe PR Review Action

A GitHub Action that reviews pull requests using AI through ClawPipe's intelligent pipeline.

## Quick Start

Add to `.github/workflows/pr-review.yml`:

```yaml
name: AI PR Review
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  pull-requests: write
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/clawpipe-pr-review@v1
        with:
          clawpipe-api-key: ${{ secrets.CLAWPIPE_API_KEY }}
          max-files: '20'
          comment-mode: 'summary'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## How It Works

1. Reads the PR diff from the GitHub API.
2. Sends the diff through ClawPipe's pipeline for review.
3. Posts a review comment on the PR with findings.

ClawPipe optimizes cost at every step:

- **Packer** compresses the diff context (large diffs benefit most).
- **Cache** returns instant results for identical diffs (re-runs, rebases with no changes).
- **Router** uses cheaper models for small/simple PRs, stronger models for complex changes.

## Inputs

| Input              | Required | Default     | Description                          |
|--------------------|----------|-------------|--------------------------------------|
| `clawpipe-api-key` | Yes      |             | Your ClawPipe API key                |
| `max-files`        | No       | `20`        | Max changed files to include         |
| `comment-mode`     | No       | `summary`   | `summary` (one comment) or `inline`  |

## Outputs

| Output   | Description                            |
|----------|----------------------------------------|
| `review` | The full review text                   |
| `cost`   | Estimated cost in USD                  |
| `cached` | Whether the result was served from cache |

## Cost Comparison

| Scenario                    | Direct GPT-4o | With ClawPipe | Savings |
|-----------------------------|---------------|---------------|---------|
| 50 PRs/day, avg 2K tokens  | $15/day       | $7/day        | 53%     |
| Re-runs on same diff        | $15/day       | $4/day        | 73%     |
| Small PRs routed to cheaper | $15/day       | $5/day        | 67%     |

**Assumptions**: Average PR diff is 2000 tokens, GPT-4o pricing. Savings come from
caching re-runs, packing large diffs, and routing small PRs to cheaper models.

## Development

```bash
npm install
npm run build    # Compiles to dist/index.js
```

## License

MIT
