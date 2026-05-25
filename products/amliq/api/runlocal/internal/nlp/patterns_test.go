package nlp

import "testing"

func TestDeployPattern(t *testing.T) {
	tests := []struct {
		input, target string
	}{
		{"deploy to staging", "staging"},
		{"deploy to production", "production"},
		{"deploy this to staging", "staging"},
	}
	for _, tt := range tests {
		a := matchPattern(tt.input)
		if a == nil || a.Type != "deploy" {
			t.Fatalf("expected deploy for %q, got %v", tt.input, a)
		}
		if a.Params["target"] != tt.target {
			t.Errorf("target = %q, want %q", a.Params["target"], tt.target)
		}
	}
}

func TestRunTestsPattern(t *testing.T) {
	for _, input := range []string{"run tests", "run only tests", "run test"} {
		a := matchPattern(input)
		if a == nil || a.Type != "run" || a.Params["checks"] != "test" {
			t.Errorf("matchPattern(%q) = %v, want run/test", input, a)
		}
	}
}

func TestDiagnosePattern(t *testing.T) {
	for _, input := range []string{
		"why did my build fail", "what went wrong", "diagnose the issue",
	} {
		a := matchPattern(input)
		if a == nil || a.Type != "diagnose" {
			t.Errorf("matchPattern(%q) = %v, want diagnose", input, a)
		}
	}
}

func TestStatusPattern(t *testing.T) {
	for _, input := range []string{"show status", "last run", "how did it go"} {
		a := matchPattern(input)
		if a == nil || a.Type != "status" {
			t.Errorf("matchPattern(%q) = %v, want status", input, a)
		}
	}
}

func TestRunLintPattern(t *testing.T) {
	for _, input := range []string{"run lint", "run linter"} {
		a := matchPattern(input)
		if a == nil || a.Type != "run" || a.Params["checks"] != "lint" {
			t.Errorf("matchPattern(%q) = %v, want run/lint", input, a)
		}
	}
}

func TestRunAllPattern(t *testing.T) {
	for _, input := range []string{"run pipeline", "run ci", "run all", "run checks"} {
		a := matchPattern(input)
		if a == nil || a.Type != "run" {
			t.Errorf("matchPattern(%q) = %v, want run", input, a)
		}
	}
}
