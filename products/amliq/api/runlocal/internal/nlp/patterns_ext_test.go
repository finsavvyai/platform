package nlp

import "testing"

func TestSecretPattern(t *testing.T) {
	tests := []struct {
		input string
		op    string
	}{
		{"set secret DB_PASS", "set"},
		{"store secret TOKEN", "set"},
		{"add secret KEY", "set"},
		{"list secrets", "list"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			a := matchPattern(tt.input)
			if a == nil || a.Type != "secret" {
				t.Fatalf("expected secret action, got %v", a)
			}
			if a.Params["operation"] != tt.op {
				t.Errorf("op = %q, want %q", a.Params["operation"], tt.op)
			}
		})
	}
}

func TestUnknownInputReturnsNil(t *testing.T) {
	inputs := []string{
		"hello world",
		"make me a sandwich",
		"",
		"what is the meaning of life",
	}
	for _, input := range inputs {
		if a := matchPattern(input); a != nil {
			t.Errorf("matchPattern(%q) = %+v, want nil", input, a)
		}
	}
}

func TestExtractAfter(t *testing.T) {
	tests := []struct {
		input, prefix, want string
	}{
		{"deploy to staging", "deploy to ", "staging"},
		{"deploy to prod env", "deploy to ", "prod"},
		{"no match here", "deploy to ", ""},
	}
	for _, tt := range tests {
		if got := extractAfter(tt.input, tt.prefix); got != tt.want {
			t.Errorf("extractAfter(%q, %q) = %q, want %q",
				tt.input, tt.prefix, got, tt.want)
		}
	}
}
