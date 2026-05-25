package ai

import (
	"testing"
)

func TestGemmaAdapter_NilSafe(t *testing.T) {
	var a *GemmaAdapter
	if a.IsConfigured() {
		t.Error("nil adapter should report unconfigured")
	}
	if a.Name() != "gemma-unconfigured" {
		t.Errorf("nil adapter Name() = %q", a.Name())
	}
}

func TestGemmaAdapter_UnconfiguredCloud(t *testing.T) {
	t.Setenv("DEEPSEEK_API_KEY", "")
	t.Setenv("GROQ_API_KEY", "")
	t.Setenv("GEMINI_API_KEY", "")
	t.Setenv("OPENROUTER_API_KEY", "")
	t.Setenv("OLLAMA_HOST", "")
	a := NewGemmaAdapter()
	if a == nil {
		t.Fatal("NewGemmaAdapter should return non-nil (defaults to local Ollama on localhost)")
	}
	// In local mode without OLLAMA_HOST, IsConfigured returns true
	// (we trust the deploy and let chain fall through on connect error).
	if !a.IsConfigured() {
		t.Error("local-mode adapter should report configured (chain handles connect failure)")
	}
}

func TestGemmaAdapter_ConfiguredCloudKey(t *testing.T) {
	t.Setenv("DEEPSEEK_API_KEY", "sk-test")
	t.Setenv("GROQ_API_KEY", "")
	t.Setenv("GEMINI_API_KEY", "")
	t.Setenv("OPENROUTER_API_KEY", "")
	a := NewGemmaAdapter()
	if a == nil {
		t.Fatal("expected non-nil adapter")
	}
	if !a.IsConfigured() {
		t.Error("adapter with API key should report configured")
	}
	if a.Name() != "deepseek" {
		t.Errorf("expected name=deepseek, got %q", a.Name())
	}
}
