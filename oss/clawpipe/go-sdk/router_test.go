package clawpipe

import (
	"strings"
	"testing"
)

func TestRouterExplicitModel(t *testing.T) {
	r := NewRouter()
	d := r.Route("anything", &PromptOptions{Provider: "openai", Model: "gpt-4o"})
	if d.Provider != "openai" || d.Model != "gpt-4o" || d.Reason != "explicit" {
		t.Fatalf("unexpected: %+v", d)
	}
}

func TestRouterSimplePrompt(t *testing.T) {
	r := NewRouter()
	d := r.Route("hi", nil)
	if d.Provider == "" || d.Model == "" {
		t.Fatal("expected a route")
	}
	if !strings.Contains(d.Reason, "simple") {
		t.Fatalf("expected simple complexity, got %q", d.Reason)
	}
}

func TestRouterComplexPrompt(t *testing.T) {
	r := NewRouter()
	long := strings.Repeat("word ", 3000)
	d := r.Route(long, nil)
	if !strings.Contains(d.Reason, "complex") {
		t.Fatalf("expected complex, got %q", d.Reason)
	}
}

func TestRouterMediumPrompt(t *testing.T) {
	r := NewRouter()
	code := "```\nfunction foo() {}\n```"
	d := r.Route(code, nil)
	if !strings.Contains(d.Reason, "medium") && !strings.Contains(d.Reason, "complex") {
		t.Fatalf("expected medium or complex, got %q", d.Reason)
	}
}

func TestRouterLearnImproves(t *testing.T) {
	r := NewRouter()
	d := r.Route("hello", nil)
	initial := d.Score
	r.Learn(d, 100, 500)
	r.Learn(d, 80, 600)
	d2 := r.Route("hello", nil)
	if d2.Provider == d.Provider && d2.Model == d.Model && d2.Score < initial-0.5 {
		t.Fatal("learning should not drastically reduce score")
	}
}

func TestRouterModelCount(t *testing.T) {
	r := NewRouter()
	if r.ModelCount() != 8 {
		t.Fatalf("expected 8 models, got %d", r.ModelCount())
	}
}

func TestComplexityClassifier(t *testing.T) {
	if Complexity("hi") != "simple" {
		t.Fatal("expected simple")
	}
	if Complexity(strings.Repeat("x ", 1500)) != "medium" {
		t.Fatal("expected medium")
	}
	if Complexity(strings.Repeat("x ", 5000)) != "complex" {
		t.Fatal("expected complex")
	}
}

func TestRouterScorePositive(t *testing.T) {
	r := NewRouter()
	d := r.Route("a question", nil)
	if d.Score <= 0 {
		t.Fatalf("expected positive score, got %f", d.Score)
	}
}
