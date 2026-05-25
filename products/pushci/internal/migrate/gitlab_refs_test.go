package migrate

import (
	"strings"
	"testing"
)

// TestGitLabReferenceExpansion mirrors the vala-gate failure mode:
// every job's `script:` mixes plain commands with
// `!reference [.anchor, script]` lookups. Before the expander, the
// re-marshal/re-unmarshal step in extractJobs failed type assertion
// on the inlined sub-list and silently dropped the entire job —
// including `deploy to ecs`. The fix must keep the deploy step.
func TestGitLabReferenceExpansion(t *testing.T) {
	src := `
stages:
  - build
  - deploy

.install_aws:
  script:
    - apt-get install -y awscli
    - aws --version

build:
  stage: build
  script:
    - !reference [.install_aws, script]
    - docker build -t app .

deploy to ecs:
  stage: deploy
  script:
    - !reference [.install_aws, script]
    - aws ecs update-service --cluster prod --service app --force-new-deployment
`
	r := ConvertGitLab(src)
	if r.JobsConverted < 2 {
		t.Fatalf("expected 2 jobs converted; got %d", r.JobsConverted)
	}
	if !strings.Contains(r.PushCIYAML, "aws ecs update-service") {
		t.Fatalf("ECS deploy line dropped from migrated YAML:\n%s", r.PushCIYAML)
	}
	if !strings.Contains(r.PushCIYAML, "apt-get install -y awscli") {
		t.Fatalf("inlined !reference content missing from migrated YAML:\n%s", r.PushCIYAML)
	}
}

func TestGitLabDeployHints_ECS(t *testing.T) {
	src := `
stages:
  - deploy

deploy to ecs:
  stage: deploy
  script:
    - aws ecs update-service --cluster prod --service app --force-new-deployment
`
	r := ConvertGitLab(src)
	if len(r.DeployHints) == 0 {
		t.Fatalf("expected ≥1 deploy hint; got 0")
	}
	found := false
	for _, h := range r.DeployHints {
		if h.Platform == "aws-ecs" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("aws-ecs hint missing; got %+v", r.DeployHints)
	}
}

func TestInferDeployHints_MultiplePlatforms(t *testing.T) {
	jobs := map[string][]string{
		"deploy-web":    {"npx wrangler pages deploy dist --project-name=web"},
		"deploy-api":    {"npx wrangler deploy --env=prod"},
		"deploy-k8s":    {"kubectl apply -f k8s/"},
		"deploy-helm":   {"helm upgrade --install app ./chart"},
		"deploy-ecs":    {"aws ecs update-service --cluster c --service s --force-new-deployment"},
		"deploy-fly":    {"fly deploy --remote-only"},
		"deploy-vercel": {"npx vercel --prod"},
	}
	hints := InferDeployHintsFromScripts(jobs, "test.yml")
	wantPlatforms := map[string]bool{
		"cloudflare-pages":   true,
		"cloudflare-workers": true,
		"kubernetes":         true,
		"helm":               true,
		"aws-ecs":            true,
		"fly":                true,
		"vercel":             true,
	}
	got := map[string]bool{}
	for _, h := range hints {
		got[h.Platform] = true
	}
	for p := range wantPlatforms {
		if !got[p] {
			t.Errorf("missing platform %q in hints %+v", p, hints)
		}
	}
}
