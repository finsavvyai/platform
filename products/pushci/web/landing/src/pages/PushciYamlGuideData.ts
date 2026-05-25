// Interactive pushci.yml syntax guide data — Simple + Complex examples.
//
// The GitHub Actions parity example lives in PushciYamlExampleActions.ts
// so this file stays under the 200-line cap. The guide page assembles
// all three into the examples array via the export below.
//
// Keep every example under ~90 lines so it fits one viewport on desktop.

import { githubActionsExample } from './PushciYamlExampleActions'

export interface YamlExample {
  id: string
  label: string
  description: string
  code: string
}

const coreExamples: YamlExample[] = [
  {
    id: 'simple',
    label: 'Simple',
    description:
      'Zero-config Node.js app. Four stages, runs locally before every push, ' +
      'deploys to Cloudflare Pages on main. This is what `pushci init` generates.',
    code: `on: [push, pull_request]

stages:
  - name: install
    checks:
      - name: deps
        run: pnpm install --frozen-lockfile

  - name: lint
    depends_on: [install]
    checks:
      - name: eslint
        run: pnpm lint

  - name: test
    depends_on: [install]
    checks:
      - name: vitest
        run: pnpm test

  - name: build
    depends_on: [install, lint, test]
    checks:
      - name: next-build
        run: pnpm build

deploy:
  trigger: push
  only_on: [main]
  run: npx wrangler pages deploy dist --project-name=my-app

notify:
  slack: "\${{ secrets.SLACK_WEBHOOK }}"
`,
  },
  {
    id: 'complex',
    label: 'Complex',
    description:
      'Full feature surface: parallel stages, cross-stage dependencies, ' +
      'conditional checks, retries, timeouts, Docker-isolated steps, ' +
      'multi-environment deploy with approval gates, and per-stage secrets.',
    code: `on: [push, pull_request, workflow_dispatch]

stages:
  - name: install
    checks:
      - name: pnpm-install
        run: pnpm install --frozen-lockfile
        retry: 2
        timeout: 3m

  - name: quality
    depends_on: [install]
    parallel: true
    env:
      NODE_ENV: test
    checks:
      - name: typecheck
        run: pnpm tsc --noEmit
      - name: lint
        run: pnpm lint
      - name: format
        run: pnpm prettier --check .
      - name: audit
        run: pnpm audit --audit-level=high
        on_fail: warn

  - name: test
    depends_on: [install]
    parallel: true
    env:
      DATABASE_URL: postgres://test:test@localhost:5432/test
    checks:
      - name: unit
        run: pnpm test:unit --coverage
      - name: integration
        run: pnpm test:integration
        retry: 1
        timeout: 5m
      - name: e2e
        if: branch == 'main' || branch =~ '^release/'
        run: pnpm test:e2e
        docker: mcr.microsoft.com/playwright:v1.49.0-focal
        timeout: 10m

  - name: security
    depends_on: [install]
    checks:
      - name: secret-scan
        run: npx gitleaks detect --no-git
      - name: sast
        run: pushci scan --engine claude --fail-on high

  - name: build
    depends_on: [quality, test, security]
    checks:
      - name: next-build
        run: pnpm build
      - name: bundle-size
        run: npx size-limit
        line-limit: 10

  - name: preview
    depends_on: [build]
    only_on: [main, develop]
    retry: 2
    retry_until: success
    checks:
      - name: deploy-preview
        run: npx wrangler pages deploy dist --branch=preview

deploy:
  trigger: push
  environments:
    - name: staging
      only_on: [develop]
      run: npx wrangler pages deploy dist --project-name=app-staging
      env:
        CF_ACCOUNT_ID: "\${{ secrets.CF_ACCOUNT_ID }}"
        CF_API_TOKEN: "\${{ secrets.CF_API_TOKEN_STAGING }}"
    - name: production
      only_on: [main]
      approve: true
      run: npx wrangler pages deploy dist --project-name=app-prod
      env:
        CF_ACCOUNT_ID: "\${{ secrets.CF_ACCOUNT_ID }}"
        CF_API_TOKEN: "\${{ secrets.CF_API_TOKEN_PROD }}"

notify:
  slack: "\${{ secrets.SLACK_WEBHOOK }}"
  discord: "\${{ secrets.DISCORD_WEBHOOK }}"
  email: oncall@example.com
`,
  },
]

// The public examples array that the guide page consumes. Order is
// intentional: Simple first (lowest friction), Complex second (shows
// the full feature surface), GitHub Actions last (the "no rewrite
// needed" promise).
export const examples: YamlExample[] = [...coreExamples, githubActionsExample]
