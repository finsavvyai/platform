package analysis

import "testing"

func TestCheckActionPinning_TagRef(t *testing.T) {
	content := `
steps:
  - uses: actions/checkout@v4
`
	findings := CheckActionPinning(content)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding for tag ref, got %d", len(findings))
	}
	f := findings[0]
	if f.Severity != SeverityMedium {
		t.Errorf("expected medium severity, got %s", f.Severity)
	}
	if f.Category != "supply-chain" {
		t.Errorf("expected supply-chain category, got %s", f.Category)
	}
	if f.Title != "Action not SHA-pinned" {
		t.Errorf("expected 'Action not SHA-pinned', got %s", f.Title)
	}
}

func TestCheckActionPinning_MasterRef(t *testing.T) {
	content := `
steps:
  - uses: actions/checkout@master
  - uses: actions/setup-go@main
`
	findings := CheckActionPinning(content)
	if len(findings) != 2 {
		t.Fatalf("expected 2 findings for branch refs, got %d", len(findings))
	}
	for _, f := range findings {
		if f.Severity != SeverityMedium {
			t.Errorf("expected medium severity, got %s", f.Severity)
		}
		if f.Category != "supply-chain" {
			t.Errorf("expected supply-chain category, got %s", f.Category)
		}
	}
}

func TestCheckActionPinning_SHAPinned(t *testing.T) {
	content := `
steps:
  - uses: actions/checkout@8ade135a3414fdbc8275a0b1beba60e6f2b2e88e
`
	findings := CheckActionPinning(content)
	if len(findings) != 0 {
		t.Errorf("expected no findings for SHA-pinned action, got %d: %+v", len(findings), findings)
	}
}

func TestCheckActionPinning_LocalPath(t *testing.T) {
	content := `
steps:
  - uses: ./local-action
  - uses: ./.github/actions/my-action
`
	findings := CheckActionPinning(content)
	if len(findings) != 0 {
		t.Errorf("expected no findings for local path actions, got %d: %+v", len(findings), findings)
	}
}

func TestCheckActionPinning_Mixed(t *testing.T) {
	content := `
steps:
  - uses: actions/checkout@8ade135a3414fdbc8275a0b1beba60e6f2b2e88e
  - uses: actions/setup-go@v5
  - uses: ./local-action
`
	findings := CheckActionPinning(content)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding for mixed refs, got %d", len(findings))
	}
	if findings[0].Title != "Action not SHA-pinned" {
		t.Errorf("unexpected finding title: %s", findings[0].Title)
	}
}
