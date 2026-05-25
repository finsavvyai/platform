package migrate

import (
	"strings"
	"testing"
)

func TestConvertCompositeSimpleShell(t *testing.T) {
	yml := `name: lint
description: run linter
runs:
  using: composite
  steps:
    - name: npm install
      run: npm install
      shell: bash
    - name: lint
      run: npm run lint
      shell: bash
`
	r := ConvertComposite([]byte(yml))
	if r.StepsKept != 2 {
		t.Fatalf("kept=%d want 2", r.StepsKept)
	}
	if !strings.Contains(r.PushCIYAML, "npm run lint") {
		t.Errorf("yaml missing lint: %s", r.PushCIYAML)
	}
}

func TestConvertCompositeWithInputs(t *testing.T) {
	yml := `name: greet
runs:
  using: composite
  steps:
    - run: echo "Hello ${{ inputs.name }}"
      shell: bash
inputs:
  name:
    description: who to greet
    required: true
`
	r := ConvertComposite([]byte(yml))
	if r.StepsKept != 1 {
		t.Fatalf("kept=%d want 1", r.StepsKept)
	}
	if !strings.Contains(r.PushCIYAML, "$PUSHCI_INPUT_NAME") {
		t.Errorf("expected rewritten input var in yaml: %s", r.PushCIYAML)
	}
	if !hasWarning(r.Warnings, "Input ${{ inputs.name }} referenced") {
		t.Errorf("missing input warning: %+v", r.Warnings)
	}
}

func TestConvertCompositeWithMarketplaceUses(t *testing.T) {
	yml := `name: deps
runs:
  using: composite
  steps:
    - uses: actions/checkout@v4
    - uses: some-org/custom-scanner@v1
    - run: echo done
      shell: bash
`
	r := ConvertComposite([]byte(yml))
	if !hasWarning(r.Warnings, "Referenced action 'some-org/custom-scanner@v1'") {
		t.Errorf("expected marketplace-action warning: %+v", r.Warnings)
	}
	if hasWarning(r.Warnings, "Referenced action 'actions/checkout@v4'") {
		t.Errorf("should not warn about mapped action actions/checkout: %+v", r.Warnings)
	}
}

func TestConvertCompositeWithOutputs(t *testing.T) {
	yml := `name: build
runs:
  using: composite
  steps:
    - run: |
        VERSION=$(cat VERSION)
        echo "version=$VERSION" >> $GITHUB_OUTPUT
      shell: bash
`
	r := ConvertComposite([]byte(yml))
	if !hasWarning(r.Warnings, "Output setting via $GITHUB_OUTPUT") {
		t.Errorf("expected output warning: %+v", r.Warnings)
	}
}

func TestConvertCompositeDockerUnsupported(t *testing.T) {
	yml := `name: scan
runs:
  using: docker
  image: Dockerfile
`
	r := ConvertComposite([]byte(yml))
	if r.PushCIYAML != "" {
		t.Errorf("expected empty yaml for docker, got %q", r.PushCIYAML)
	}
	if !hasWarning(r.Warnings, "runs.using: docker") {
		t.Errorf("expected docker warning: %+v", r.Warnings)
	}
}

func hasWarning(warnings []string, substr string) bool {
	for _, w := range warnings {
		if strings.Contains(w, substr) {
			return true
		}
	}
	return false
}
