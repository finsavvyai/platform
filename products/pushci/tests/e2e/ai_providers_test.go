package e2e

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/ai"
)

func TestAIProviders_NoKeysReturnsUnconfigured(t *testing.T) {
	// Clear all provider keys so NewClient returns the unconfigured fallback.
	t.Setenv("GROQ_API_KEY", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("DEEPSEEK_API_KEY", "")
	t.Setenv("OPEN_AI_KEY", "")
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("GEMINI_API_KEY", "")
	t.Setenv("PUSHCI_AI_PROVIDER", "")

	client := ai.NewClient()
	if client == nil {
		t.Fatal("NewClient returned nil, expected an unconfigured client")
	}
	if client.IsConfigured() {
		t.Error("expected IsConfigured() == false when no API keys are set")
	}
}

func TestAIProviders_GroqKeySelectsGroq(t *testing.T) {
	t.Setenv("GROQ_API_KEY", "fake-groq-key")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("PUSHCI_AI_PROVIDER", "")

	client := ai.NewClient()
	if client == nil {
		t.Fatal("NewClient returned nil")
	}
	if client.Provider() != ai.ProviderGroq {
		t.Errorf("expected provider groq, got %q", client.Provider())
	}
	if !client.IsConfigured() {
		t.Error("expected IsConfigured() == true with GROQ_API_KEY set")
	}
}

func TestAIProviders_AnthropicKeySelectsAnthropic(t *testing.T) {
	t.Setenv("GROQ_API_KEY", "")
	t.Setenv("ANTHROPIC_API_KEY", "fake-anthropic-key")
	t.Setenv("PUSHCI_AI_PROVIDER", "")

	client := ai.NewClient()
	if client == nil {
		t.Fatal("NewClient returned nil")
	}
	if client.Provider() != ai.ProviderAnthropic {
		t.Errorf("expected provider anthropic, got %q", client.Provider())
	}
	if !client.IsConfigured() {
		t.Error("expected IsConfigured() == true with ANTHROPIC_API_KEY set")
	}
}

func TestAIProviders_GroqTakesPriorityOverAnthropic(t *testing.T) {
	// Both keys set: Groq wins per priority order.
	t.Setenv("GROQ_API_KEY", "fake-groq-key")
	t.Setenv("ANTHROPIC_API_KEY", "fake-anthropic-key")
	t.Setenv("PUSHCI_AI_PROVIDER", "")

	client := ai.NewClient()
	if client.Provider() != ai.ProviderGroq {
		t.Errorf("expected Groq to win when both GROQ_API_KEY and ANTHROPIC_API_KEY are set, got %q", client.Provider())
	}
}

func TestAIProviders_ForceOverrideAnthropic(t *testing.T) {
	t.Setenv("GROQ_API_KEY", "fake-groq-key") // would normally win
	t.Setenv("ANTHROPIC_API_KEY", "fake-anthropic-key")
	t.Setenv("PUSHCI_AI_PROVIDER", "anthropic") // explicit override

	client := ai.NewClient()
	if client.Provider() != ai.ProviderAnthropic {
		t.Errorf("expected anthropic via PUSHCI_AI_PROVIDER override, got %q", client.Provider())
	}
}

func TestAIProviders_ForceOverrideCaseInsensitive(t *testing.T) {
	t.Setenv("ANTHROPIC_API_KEY", "fake-anthropic-key")
	t.Setenv("PUSHCI_AI_PROVIDER", "ANTHROPIC") // uppercase override

	client := ai.NewClient()
	if client.Provider() != ai.ProviderAnthropic {
		t.Errorf("expected case-insensitive override to work, got %q", client.Provider())
	}
}

func TestAIProviders_ForceOverrideGroq(t *testing.T) {
	t.Setenv("GROQ_API_KEY", "fake-groq-key")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("PUSHCI_AI_PROVIDER", "groq")

	client := ai.NewClient()
	if client.Provider() != ai.ProviderGroq {
		t.Errorf("expected groq via PUSHCI_AI_PROVIDER, got %q", client.Provider())
	}
}

func TestAIProviders_DeepSeekKey(t *testing.T) {
	t.Setenv("GROQ_API_KEY", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("DEEPSEEK_API_KEY", "fake-deepseek-key")
	t.Setenv("PUSHCI_AI_PROVIDER", "")

	client := ai.NewClient()
	if client.Provider() != ai.ProviderDeepSeek {
		t.Errorf("expected deepseek provider, got %q", client.Provider())
	}
}

func TestAIProviders_InvalidOverrideFallsThrough(t *testing.T) {
	// An unrecognised provider name should fall through to key-based selection.
	t.Setenv("ANTHROPIC_API_KEY", "fake-anthropic-key")
	t.Setenv("GROQ_API_KEY", "")
	t.Setenv("PUSHCI_AI_PROVIDER", "nonexistent-provider")

	client := ai.NewClient()
	// Falls through to key-based: ANTHROPIC_API_KEY set → anthropic
	if client.Provider() != ai.ProviderAnthropic {
		t.Errorf("expected fallthrough to anthropic for unknown PUSHCI_AI_PROVIDER, got %q", client.Provider())
	}
}
