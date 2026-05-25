package ai

import "testing"

// clearAllProviderEnv zeros every key NewClient() inspects so each
// test case gets a deterministic starting point regardless of what
// the developer happens to have exported in their shell.
func clearAllProviderEnv(t *testing.T) {
	t.Helper()
	for _, k := range []string{
		"PUSHCI_AI_PROVIDER",
		"GROQ_API_KEY",
		"ANTHROPIC_API_KEY",
		"DEEPSEEK_API_KEY",
		"OPEN_AI_KEY",
		"OPENAI_API_KEY",
		"GEMINI_API_KEY",
	} {
		t.Setenv(k, "")
	}
}

func TestNewClient_GroqBeatsAnthropicWhenBothSet(t *testing.T) {
	clearAllProviderEnv(t)
	t.Setenv("GROQ_API_KEY", "gsk_test")
	t.Setenv("ANTHROPIC_API_KEY", "sk_ant_test")

	c := NewClient()
	if c.Provider() != ProviderGroq {
		t.Errorf("expected Groq to win priority, got %s", c.Provider())
	}
}

func TestNewClient_FallsBackAnthropicWhenNoGroq(t *testing.T) {
	clearAllProviderEnv(t)
	t.Setenv("ANTHROPIC_API_KEY", "sk_ant_test")

	c := NewClient()
	if c.Provider() != ProviderAnthropic {
		t.Errorf("expected Anthropic fallback, got %s", c.Provider())
	}
}

func TestNewClient_DeepSeekAfterGroqAndAnthropic(t *testing.T) {
	clearAllProviderEnv(t)
	t.Setenv("DEEPSEEK_API_KEY", "ds_test")

	c := NewClient()
	if c.Provider() != ProviderDeepSeek {
		t.Errorf("expected DeepSeek, got %s", c.Provider())
	}
}

func TestNewClient_OpenAIKeyVariants(t *testing.T) {
	clearAllProviderEnv(t)
	t.Setenv("OPEN_AI_KEY", "sk_test")
	if NewClient().Provider() != ProviderOpenAI {
		t.Error("OPEN_AI_KEY variant should pick OpenAI")
	}

	clearAllProviderEnv(t)
	t.Setenv("OPENAI_API_KEY", "sk_test")
	if NewClient().Provider() != ProviderOpenAI {
		t.Error("OPENAI_API_KEY variant should pick OpenAI")
	}
}

func TestNewClient_GeminiLast(t *testing.T) {
	clearAllProviderEnv(t)
	t.Setenv("GEMINI_API_KEY", "gm_test")

	c := NewClient()
	if c.Provider() != ProviderGemini {
		t.Errorf("expected Gemini, got %s", c.Provider())
	}
}

func TestNewClient_NoKeysReturnsUnconfigured(t *testing.T) {
	clearAllProviderEnv(t)

	c := NewClient()
	if c.IsConfigured() {
		t.Error("expected unconfigured client when no keys set")
	}
}

func TestNewClient_ProviderOverride(t *testing.T) {
	cases := []struct {
		override string
		keyEnv   string
		keyVal   string
		want     Provider
	}{
		{"anthropic", "ANTHROPIC_API_KEY", "sk_ant", ProviderAnthropic},
		{"claude", "ANTHROPIC_API_KEY", "sk_ant", ProviderAnthropic},
		{"groq", "GROQ_API_KEY", "gsk_test", ProviderGroq},
		{"deepseek", "DEEPSEEK_API_KEY", "ds_test", ProviderDeepSeek},
		{"openai", "OPEN_AI_KEY", "sk_test", ProviderOpenAI},
		{"gemini", "GEMINI_API_KEY", "gm_test", ProviderGemini},
		{"google", "GEMINI_API_KEY", "gm_test", ProviderGemini},
	}
	for _, tc := range cases {
		t.Run(tc.override, func(t *testing.T) {
			clearAllProviderEnv(t)
			t.Setenv("PUSHCI_AI_PROVIDER", tc.override)
			t.Setenv(tc.keyEnv, tc.keyVal)

			c := NewClient()
			if c.Provider() != tc.want {
				t.Errorf("override=%q got %s, want %s", tc.override, c.Provider(), tc.want)
			}
		})
	}
}

func TestNewClient_ProviderOverride_UnknownNameFallsThrough(t *testing.T) {
	clearAllProviderEnv(t)
	t.Setenv("PUSHCI_AI_PROVIDER", "madeup-provider")
	t.Setenv("GROQ_API_KEY", "gsk_test")

	c := NewClient()
	if c.Provider() != ProviderGroq {
		t.Errorf("unknown override should fall through to priority order, got %s", c.Provider())
	}
}

func TestNewClient_ProviderOverride_IsCaseInsensitive(t *testing.T) {
	clearAllProviderEnv(t)
	t.Setenv("PUSHCI_AI_PROVIDER", "GROQ")
	t.Setenv("GROQ_API_KEY", "gsk_test")

	if NewClient().Provider() != ProviderGroq {
		t.Error("override should be case-insensitive")
	}
}
