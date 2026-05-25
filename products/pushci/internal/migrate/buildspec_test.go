package migrate

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConvertBuildspecSimple(t *testing.T) {
	yml := `version: 0.2
phases:
  install:
    commands:
      - npm install
  build:
    commands:
      - npm test
      - npm run build
`
	r := ConvertBuildspec(yml)
	if r.StagesConverted != 2 {
		t.Errorf("stages = %d, want 2", r.StagesConverted)
	}
	if r.StepsConverted != 3 {
		t.Errorf("steps = %d, want 3", r.StepsConverted)
	}
	if !strings.Contains(r.PushCIYAML, "- name: install") || !strings.Contains(r.PushCIYAML, "- name: build") {
		t.Errorf("missing expected stage names:\n%s", r.PushCIYAML)
	}
	if !strings.Contains(r.PushCIYAML, "depends_on:\n      - install") {
		t.Errorf("expected build to depend on install:\n%s", r.PushCIYAML)
	}
}

func TestConvertBuildspecEnvSecrets(t *testing.T) {
	yml := `version: 0.2
env:
  variables:
    AWS_DEFAULT_REGION: eu-north-1
  secrets-manager:
    DOCKERHUB_USERNAME: docker-hub:username
  parameter-store:
    LOGIN_PASSWORD: /CodeBuild/dockerLoginPassword
  exported-variables:
    - VERSION
phases:
  build:
    commands:
      - echo hi
`
	r := ConvertBuildspec(yml)
	joined := strings.Join(r.Warnings, "\n")
	for _, want := range []string{
		"SECRET: DOCKERHUB_USERNAME",
		"SSM: LOGIN_PASSWORD",
		"exported-variable 'VERSION'",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("missing warning %q in:\n%s", want, joined)
		}
	}
	var hasSecret, hasSSM bool
	for _, e := range r.EnvVarsNeeded {
		if e.Name == "DOCKERHUB_USERNAME" && e.IsSecret {
			hasSecret = true
		}
		if e.Name == "LOGIN_PASSWORD" && e.IsSecret {
			hasSSM = true
		}
	}
	if !hasSecret || !hasSSM {
		t.Errorf("secret/ssm refs missing: %+v", r.EnvVarsNeeded)
	}
}

func TestConvertBuildspecFinallyAndOnFailure(t *testing.T) {
	yml := `version: 0.2
phases:
  pre_build:
    commands:
      - echo pre
    finally:
      - echo cleanup
  build:
    commands:
      - flaky-test
    on-failure: CONTINUE
`
	r := ConvertBuildspec(yml)
	if !strings.Contains(r.PushCIYAML, "pre_build-finally-1") {
		t.Errorf("finally block not emitted as check:\n%s", r.PushCIYAML)
	}
	if !strings.Contains(r.PushCIYAML, "continue_on_error: true") {
		t.Errorf("on-failure: CONTINUE not translated:\n%s", r.PushCIYAML)
	}
	if !strings.Contains(strings.Join(r.Warnings, "\n"), "finally") {
		t.Errorf("expected finally warning, got %v", r.Warnings)
	}
}

func TestConvertBuildspecTeddkFixture(t *testing.T) {
	path := filepath.Join("testdata", "buildspec_teddk.yml")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	r := ConvertBuildspec(string(data))
	if r.StagesConverted != 4 {
		t.Errorf("teddk stages = %d, want 4", r.StagesConverted)
	}
	joined := strings.Join(r.Warnings, "\n")
	for _, want := range []string{"SECRET: DOCKERHUB_USERNAME", "SECRET: DOCKERHUB_PASSWORD", "cache path"} {
		if !strings.Contains(joined, want) {
			t.Errorf("teddk: missing warning %q", want)
		}
	}
	if !strings.Contains(r.PushCIYAML, "mvn deploy") {
		t.Errorf("teddk: expected mvn deploy in output")
	}
}

func TestConvertBuildspecInvalid(t *testing.T) {
	r := ConvertBuildspec("not: [valid: yaml")
	if len(r.Warnings) == 0 || !strings.Contains(r.Warnings[0], "Failed to parse") {
		t.Errorf("expected parse failure warning, got %v", r.Warnings)
	}
}
