package screening

import (
	"context"
	"testing"
)

type mockLLM struct {
	response string
}

func (m *mockLLM) Complete(_ context.Context, _ string) (string, error) {
	return m.response, nil
}

func TestMediaClassifier(t *testing.T) {
	llm := &mockLLM{response: `{"categories":["money_laundering","fraud"],"severity":8,"entities":["John Doe"],"confirmed":false,"summary":"Alleged ML scheme"}`}
	classifier := NewMediaClassifier(llm)

	result, err := classifier.Classify(context.Background(), "Test Article", "Content about money laundering", "reuters.com")
	if err != nil {
		t.Fatalf("Classify error: %v", err)
	}

	tests := []struct {
		name  string
		check func() bool
	}{
		{"categories", func() bool { return len(result.Categories) == 2 }},
		{"severity", func() bool { return result.Severity == 8 }},
		{"entities", func() bool { return len(result.Entities) == 1 && result.Entities[0] == "John Doe" }},
		{"not_confirmed", func() bool { return !result.Confirmed }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.check() {
				t.Error("check failed")
			}
		})
	}
}

func TestExtractJSON(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{`Here is the result: {"a":1} done`, `{"a":1}`},
		{`{"a":1}`, `{"a":1}`},
		{`no json here`, `no json here`},
	}
	for _, tt := range tests {
		got := extractJSON(tt.input)
		if got != tt.want {
			t.Errorf("extractJSON(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
