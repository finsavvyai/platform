package config

import (
	"os"
	"testing"
)

// TestLoad_TenantiqUserPushCIYml parses the exact file the
// v1.4.3 user reported as "dead config" — list-form deploy with
// per-target trigger/path/verify/depends_on that the old schema
// refused. Keeping the file inline so the regression can't be
// lost to a deleted fixture.
func TestLoad_TenantiqUserPushCIYml(t *testing.T) {
	path := t.TempDir() + "/pushci.yml"
	if err := os.WriteFile(path, []byte(tenantiqYAML), 0o644); err != nil {
		t.Fatal(err)
	}
	p, err := Load(path)
	if err != nil {
		t.Fatalf("Load failed on the real user file: %v", err)
	}
	if len(p.Stages) != 5 {
		t.Errorf("Stages = %d, want 5 (install/build/test/lint/typecheck)", len(p.Stages))
	}
	if len(p.Deploys) != 3 {
		t.Fatalf("Deploys = %d, want 3 (landing/api/web)", len(p.Deploys))
	}

	landing := p.Deploys[0]
	if landing.Name != "landing" || landing.Trigger != "merge to main" || landing.Path != "landing-page/deploy" {
		t.Errorf("landing target malformed: %+v", landing)
	}
	if landing.Verify == nil || landing.Verify.URL != "https://tenantiq.app" || landing.Verify.Expect != "200" || landing.Verify.Retries != 6 || landing.Verify.Interval != "10s" {
		t.Errorf("landing.Verify malformed: %+v", landing.Verify)
	}

	api := p.Deploys[1]
	if len(api.DependsOn) != 2 || api.DependsOn[0] != "test" || api.DependsOn[1] != "typecheck" {
		t.Errorf("api.DependsOn = %v, want [test typecheck]", api.DependsOn)
	}
	if api.Verify == nil || api.Verify.Expect != "status.*healthy" {
		t.Errorf("api.Verify malformed: %+v", api.Verify)
	}

	web := p.Deploys[2]
	if len(web.DependsOn) != 2 || web.DependsOn[0] != "test" || web.DependsOn[1] != "build" {
		t.Errorf("web.DependsOn = %v, want [test build]", web.DependsOn)
	}
}

const tenantiqYAML = `
on:
  - push
  - pull_request

stages:
  - name: install
    checks:
      - name: npm-install
        run: pnpm install --frozen-lockfile

  - name: build
    checks:
      - name: build
        run: pnpm run build
    depends_on:
      - install

  - name: test
    checks:
      - name: test
        run: pnpm test
    depends_on:
      - install
    parallel: true

  - name: lint
    checks:
      - name: lint
        run: pnpm run lint
    depends_on:
      - install
    parallel: true

  - name: typecheck
    checks:
      - name: api-typecheck
        run: npx tsc --noEmit -p apps/api/tsconfig.json
      - name: line-limit
        run: bash scripts/check-max-lines.sh
    depends_on:
      - install
    parallel: true

deploy:
  - name: landing
    trigger: merge to main
    path: landing-page/deploy
    run: npx wrangler pages deploy landing-page/deploy --project-name=tenantiq-landing --branch=main --commit-dirty=true
    verify:
      url: https://tenantiq.app
      expect: 200
      retries: 6
      interval: 10s

  - name: api
    trigger: merge to main
    depends_on:
      - test
      - typecheck
    run: cd apps/api && npx wrangler deploy
    verify:
      url: https://api.tenantiq.app/health
      expect: "status.*healthy"
      retries: 12
      interval: 5s

  - name: web
    trigger: merge to main
    depends_on:
      - test
      - build
    run: npx wrangler pages deploy apps/web/.svelte-kit/cloudflare --project-name=tenantiq-web --branch=main --commit-dirty=true
    verify:
      url: https://app.tenantiq.app
      expect: 200
      retries: 6
      interval: 10s
`
