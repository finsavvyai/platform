package migrate

import (
	"strings"
	"testing"
)

// Top-level before_script only — must emit a `setup` stage, NOT deploy.
func TestGitLabBeforeScriptTopLevelEmitsSetup(t *testing.T) {
	yaml := `
stages:
  - test

before_script:
  - apt-get update
  - apt-get install -y curl

test-job:
  stage: test
  script:
    - pytest
`
	r := ConvertGitLab(yaml)
	if !strings.Contains(r.PushCIYAML, "- name: setup") {
		t.Fatalf("expected setup stage, got:\n%s", r.PushCIYAML)
	}
	if strings.Contains(r.PushCIYAML, "- name: deploy") {
		t.Fatalf("top-level before_script leaked into deploy stage:\n%s", r.PushCIYAML)
	}
	if !strings.Contains(r.PushCIYAML, "apt-get update") {
		t.Fatalf("setup command missing from output:\n%s", r.PushCIYAML)
	}
}

// Per-job before_script — must be prepended to that stage's commands.
func TestGitLabBeforeScriptPerJobPrepended(t *testing.T) {
	yaml := `
stages:
  - test

test-job:
  stage: test
  before_script:
    - pip install -r requirements.txt
  script:
    - pytest
`
	r := ConvertGitLab(yaml)
	pipIdx := strings.Index(r.PushCIYAML, "pip install")
	pytestIdx := strings.Index(r.PushCIYAML, "pytest")
	if pipIdx < 0 || pytestIdx < 0 {
		t.Fatalf("missing commands in output:\n%s", r.PushCIYAML)
	}
	if pipIdx > pytestIdx {
		t.Fatalf("pip install should run BEFORE pytest:\n%s", r.PushCIYAML)
	}
}

// Shared top-level before_script across 3 jobs — one setup stage only;
// each downstream stage ends up depending on setup (via chain).
func TestGitLabBeforeScriptSharedEmitsOneSetup(t *testing.T) {
	yaml := `
stages:
  - lint
  - test
  - build

before_script:
  - npm ci

lint-job:
  stage: lint
  script: [npm run lint]

test-job:
  stage: test
  script: [npm test]

build-job:
  stage: build
  script: [npm run build]
`
	r := ConvertGitLab(yaml)
	if c := strings.Count(r.PushCIYAML, "- name: setup\n"); c != 1 {
		t.Fatalf("expected exactly 1 setup stage, got %d:\n%s", c, r.PushCIYAML)
	}
	// First non-setup stage must chain off setup
	if !strings.Contains(r.PushCIYAML, "depends_on:\n      - setup") {
		t.Fatalf("expected downstream stage to depend_on setup:\n%s", r.PushCIYAML)
	}
}

// Top-level after_script — emits cleanup stage + warning.
func TestGitLabAfterScriptEmitsCleanup(t *testing.T) {
	yaml := `
stages:
  - test

after_script:
  - echo done

test-job:
  stage: test
  script: [pytest]
`
	r := ConvertGitLab(yaml)
	if !strings.Contains(r.PushCIYAML, "- name: cleanup") {
		t.Fatalf("expected cleanup stage:\n%s", r.PushCIYAML)
	}
	warned := false
	for _, w := range r.Warnings {
		if strings.Contains(w, "after_script") {
			warned = true
		}
	}
	if !warned {
		t.Fatalf("expected after_script warning, got: %v", r.Warnings)
	}
}

// Real deploy-like job (stage: deploy) with only a script — should
// still land in a stage named `deploy`, not be treated as setup.
// This guards against over-eager rerouting.
func TestGitLabRealDeployStageUnaffected(t *testing.T) {
	yaml := `
stages:
  - deploy

deploy-job:
  stage: deploy
  script:
    - aws deploy
  environment:
    name: production
`
	r := ConvertGitLab(yaml)
	if !strings.Contains(r.PushCIYAML, "- name: deploy") {
		t.Fatalf("expected deploy stage to survive:\n%s", r.PushCIYAML)
	}
	if !strings.Contains(r.PushCIYAML, "aws deploy") {
		t.Fatalf("deploy command missing:\n%s", r.PushCIYAML)
	}
	if strings.Contains(r.PushCIYAML, "- name: setup") {
		t.Fatalf("no top-level before_script but setup stage was emitted:\n%s", r.PushCIYAML)
	}
}

// Lambda-layers regression: a deploy job with a heavy before_script
// should NOT lose its before_script commands. They get prepended to
// the same `deploy` stage — not routed anywhere else.
func TestGitLabLambdaLayersRegression(t *testing.T) {
	yaml := `
stages:
  - deploy

deploy-lambda-layer:
  stage: deploy
  before_script:
    - export AWS_ACCESS_KEY_ID=$PIPELINE_AWS_ACCESS_KEY_ID
  script:
    - apt-get update
    - ./deploy-lambda-layer.sh
`
	r := ConvertGitLab(yaml)
	exportIdx := strings.Index(r.PushCIYAML, "export AWS_ACCESS_KEY_ID")
	deployIdx := strings.Index(r.PushCIYAML, "./deploy-lambda-layer.sh")
	if exportIdx < 0 {
		t.Fatalf("before_script export lost:\n%s", r.PushCIYAML)
	}
	if exportIdx > deployIdx {
		t.Fatalf("export should run before deploy:\n%s", r.PushCIYAML)
	}
}
