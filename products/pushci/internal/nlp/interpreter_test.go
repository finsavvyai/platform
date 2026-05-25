package nlp

import (
	"context"
	"testing"

	"github.com/finsavvyai/pushci/internal/ai"
)

func TestMatchPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantType string
		wantKey  string
		wantVal  string
	}{
		{"deploy staging", "deploy to staging", "deploy", "target", "staging"},
		{"deploy this to prod", "deploy this to production", "deploy", "target", "production"},
		{"diagnose failure", "why did my build fail?", "diagnose", "", ""},
		{"run tests only", "run only tests", "run", "checks", "test"},
		{"run lint", "run linter", "run", "checks", "lint"},
		{"run all", "run pipeline", "run", "", ""},
		{"show status", "show me the status", "status", "", ""},
		{"list secrets", "list secrets", "secret", "operation", "list"},
		{"unknown input", "hello world", "", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			action := matchPattern(tt.input)
			if tt.wantType == "" {
				if action != nil {
					t.Errorf("expected nil, got %+v", action)
				}
				return
			}
			if action == nil {
				t.Fatalf("expected action type %q, got nil", tt.wantType)
			}
			if action.Type != tt.wantType {
				t.Errorf("type = %q, want %q", action.Type, tt.wantType)
			}
			if tt.wantKey != "" && action.Params[tt.wantKey] != tt.wantVal {
				t.Errorf("params[%q] = %q, want %q", tt.wantKey, action.Params[tt.wantKey], tt.wantVal)
			}
		})
	}
}

func TestInterpreterFastPath(t *testing.T) {
	interp := NewInterpreter(ai.NewClient())
	ctx := context.Background()
	rc := RepoContext{Root: "/tmp/test", Branch: "main"}

	tests := []struct {
		name     string
		input    string
		wantType string
	}{
		{"deploy", "deploy to staging", "deploy"},
		{"diagnose", "why did my build fail?", "diagnose"},
		{"run", "run pipeline", "run"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			action, err := interp.Interpret(ctx, tt.input, rc)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if action.Type != tt.wantType {
				t.Errorf("type = %q, want %q", action.Type, tt.wantType)
			}
		})
	}
}

func TestExecuteActionRouting(t *testing.T) {
	tests := []struct {
		name       string
		actionType string
		wantErr    bool
	}{
		{"unknown type", "foobar", true},
		{"status type", "status", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			action := &Action{Type: tt.actionType, Params: map[string]string{}}
			_, err := ExecuteAction(context.Background(), action, "/tmp")
			if (err != nil) != tt.wantErr {
				t.Errorf("err = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}
