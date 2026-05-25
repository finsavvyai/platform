package migrate

import (
	"strings"
	"testing"
)

func TestCloudBuildSimpleSteps(t *testing.T) {
	yaml := `
steps:
  - name: gcr.io/cloud-builders/npm
    args: ['install']
  - name: gcr.io/cloud-builders/npm
    args: ['test']
`
	r := ConvertCloudBuild([]byte(yaml))
	if r.StepsKept != 2 {
		t.Fatalf("kept=%d want 2", r.StepsKept)
	}
	if !strings.Contains(r.PushCIYAML, "run: install") {
		t.Errorf("expected 'run: install' in yaml, got:\n%s", r.PushCIYAML)
	}
	if !strings.Contains(r.PushCIYAML, "# image: gcr.io/cloud-builders/npm") {
		t.Errorf("expected image comment, got:\n%s", r.PushCIYAML)
	}
}

func TestCloudBuildWaitForParallelism(t *testing.T) {
	yaml := `
steps:
  - name: gcr.io/cloud-builders/go
    id: build
    args: ['build', './...']
  - name: gcr.io/cloud-builders/go
    id: test
    args: ['test', './...']
    waitFor: ['build']
  - name: gcr.io/cloud-builders/go
    id: lint
    args: ['vet', './...']
    waitFor: ['-']
`
	r := ConvertCloudBuild([]byte(yaml))
	if r.StepsKept != 3 {
		t.Fatalf("kept=%d want 3", r.StepsKept)
	}
	if !strings.Contains(r.PushCIYAML, "depends_on:\n      - build") {
		t.Errorf("test stage should depend on build, got:\n%s", r.PushCIYAML)
	}
	// lint uses waitFor:['-'] → NO depends_on
	lintIdx := strings.Index(r.PushCIYAML, "- name: lint")
	if lintIdx < 0 {
		t.Fatal("lint stage missing")
	}
	if strings.Contains(r.PushCIYAML[lintIdx:], "depends_on") {
		t.Errorf("lint (waitFor:['-']) should have no depends_on")
	}
}

func TestCloudBuildSubstitutionsAndProjectID(t *testing.T) {
	yaml := `
substitutions:
  _USER_VAR: hello
steps:
  - name: gcr.io/cloud-builders/gcloud
    args: ['app', 'deploy', '--project=$PROJECT_ID']
`
	r := ConvertCloudBuild([]byte(yaml))
	if !strings.Contains(r.PushCIYAML, "_USER_VAR: \"hello\"") {
		t.Errorf("substitution missing, got:\n%s", r.PushCIYAML)
	}
	foundProjectID := false
	for _, w := range r.Warnings {
		if strings.Contains(w, "$PROJECT_ID") {
			foundProjectID = true
		}
	}
	if !foundProjectID {
		t.Errorf("expected $PROJECT_ID warning, got: %v", r.Warnings)
	}
}

func TestCloudBuildSecretsWarning(t *testing.T) {
	yaml := `
secrets:
  - kmsKeyName: projects/p/locations/l/keyRings/k/cryptoKeys/c
    secretEnv:
      API_KEY: AAABBB
steps:
  - name: gcr.io/cloud-builders/curl
    args: ['https://api.example.com']
    secretEnv: ['API_KEY']
`
	r := ConvertCloudBuild([]byte(yaml))
	var topSec, stepSec bool
	for _, w := range r.Warnings {
		if strings.Contains(w, "pushci secret set") && strings.Contains(w, "KMS") {
			topSec = true
		}
		if strings.Contains(w, "secretEnv [API_KEY]") {
			stepSec = true
		}
	}
	if !topSec || !stepSec {
		t.Errorf("secrets warnings missing (top=%v step=%v): %v", topSec, stepSec, r.Warnings)
	}
}

func TestCloudBuildEntrypointOverride(t *testing.T) {
	yaml := `
steps:
  - name: node:20
    entrypoint: bash
    args: ['-c', 'npm ci && npm test']
`
	r := ConvertCloudBuild([]byte(yaml))
	if !strings.Contains(r.PushCIYAML, "run: bash -c 'npm ci && npm test'") {
		t.Errorf("expected entrypoint prepended and args quoted, got:\n%s", r.PushCIYAML)
	}
}
