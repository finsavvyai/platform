package migrate

import (
	"strings"
	"testing"
)

func TestConvertBuildkiteCommandStep(t *testing.T) {
	yml := `steps:
  - label: ":lint:"
    key: lint
    command: npm run lint
  - label: test
    key: test
    commands:
      - npm install
      - npm test
    depends_on: lint
    timeout_in_minutes: 10
`
	r := ConvertBuildkite(yml)
	if r.StagesConverted != 2 {
		t.Errorf("stages = %d, want 2", r.StagesConverted)
	}
	if r.StepsConverted != 3 {
		t.Errorf("steps = %d, want 3", r.StepsConverted)
	}
	if !strings.Contains(r.PushCIYAML, "timeout_minutes: 10") {
		t.Errorf("missing timeout in output:\n%s", r.PushCIYAML)
	}
	if !strings.Contains(r.PushCIYAML, "depends_on:\n      - lint") {
		t.Errorf("missing explicit depends_on in output:\n%s", r.PushCIYAML)
	}
}

func TestConvertBuildkiteGroupFlattens(t *testing.T) {
	yml := `steps:
  - group: "Test suite"
    steps:
      - label: unit
        command: npm test
      - label: integ
        command: npm run integ
`
	r := ConvertBuildkite(yml)
	if r.StagesConverted != 2 {
		t.Errorf("stages = %d, want 2", r.StagesConverted)
	}
	if !strings.Contains(r.PushCIYAML, "test-suite-unit") {
		t.Errorf("group prefix missing:\n%s", r.PushCIYAML)
	}
}

func TestConvertBuildkiteWarnings(t *testing.T) {
	yml := `env:
  API_TOKEN: shh
  NODE_ENV: production
steps:
  - label: deploy
    command: ./deploy.sh
    parallelism: 4
    plugins:
      - docker-login#v2.0.0
      - { artifacts#v1.2.0: { upload: "dist/*" } }
  - wait
  - block: "release gate"
  - input: "deploy prod?"
`
	r := ConvertBuildkite(yml)

	wantWarn := []string{
		"parallelism=4",
		"plugin 'docker-login#v2.0.0'",
		"wait",
		"block",
		"input",
		"SECRET: API_TOKEN",
	}
	joined := strings.Join(r.Warnings, "\n")
	for _, w := range wantWarn {
		if !strings.Contains(joined, w) {
			t.Errorf("missing warning %q in:\n%s", w, joined)
		}
	}
	if r.StepsSkipped < 3 {
		t.Errorf("skipped = %d, want ≥3 (wait+block+input)", r.StepsSkipped)
	}

	foundSecret := false
	for _, e := range r.EnvVarsNeeded {
		if e.Name == "API_TOKEN" && e.IsSecret {
			foundSecret = true
		}
	}
	if !foundSecret {
		t.Error("expected API_TOKEN flagged as secret env var")
	}
}

func TestConvertBuildkiteEmptyAndInvalid(t *testing.T) {
	r := ConvertBuildkite("not: [valid: yaml")
	if len(r.Warnings) == 0 || !strings.Contains(r.Warnings[0], "Failed to parse") {
		t.Errorf("expected parse failure warning, got %v", r.Warnings)
	}

	r = ConvertBuildkite("steps: []\n")
	if r.StagesConverted != 0 {
		t.Errorf("empty pipeline should produce 0 stages, got %d", r.StagesConverted)
	}
}
