import type { YamlExample } from './PushciYamlGuideData'

// GitHub Actions parity example — the longest fixture, split out so
// PushciYamlGuideData.ts stays under the 200-line cap.
export const githubActionsExample: YamlExample = {
  id: 'github-actions',
  label: 'GitHub Actions parity',
  description:
    'PushCI v1.3.1+ runs your existing .github/workflows/*.yml files ' +
    'end-to-end via the embedded act runtime. No rewrite needed — ' +
    'actions/checkout@v4, matrix builds, secrets masking, composite ' +
    'actions, service containers all work. Drop this into ' +
    '.github/workflows/ci.yml and run `pushci actions run`.',
  code: `name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: [20, 22]
        os: [ubuntu-latest]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
          cache: 'pnpm'
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/postgres
      - id: coverage
        run: echo "pct=\$(pnpm test:coverage --silent)" >> \$GITHUB_OUTPUT
    outputs:
      coverage: \${{ steps.coverage.outputs.pct }}

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: echo "coverage was \${{ needs.test.outputs.coverage }}"
        env:
          CF_API_TOKEN: \${{ secrets.CF_API_TOKEN }}
`,
}
