package ai

import "os"

// ProviderConfig describes an LLM backend.
type ProviderConfig struct {
	Name     string
	Endpoint string
	APIKey   string
	Model    string
	IsGemini bool // Gemini uses non-OpenAI format
}

// DetectProvider picks the first configured provider in priority order.
// Priority: DeepSeek → Gemini → Groq → OpenRouter → Anthropic.
// Returns nil if none configured.
func DetectProvider() *ProviderConfig {
	if k := os.Getenv("DEEPSEEK_API_KEY"); k != "" {
		return &ProviderConfig{
			Name:     "deepseek",
			Endpoint: "https://api.deepseek.com/v1",
			APIKey:   k,
			Model:    envOrDefault("DEEPSEEK_MODEL", "deepseek-chat"),
		}
	}
	if k := os.Getenv("GROQ_API_KEY"); k != "" {
		return &ProviderConfig{
			Name:     "groq",
			Endpoint: "https://api.groq.com/openai/v1",
			APIKey:   k,
			Model:    envOrDefault("GROQ_MODEL", "llama-3.3-70b-versatile"),
		}
	}
	if k := os.Getenv("GEMINI_API_KEY"); k != "" {
		return &ProviderConfig{
			Name:     "gemini",
			Endpoint: "https://generativelanguage.googleapis.com/v1beta",
			APIKey:   k,
			Model:    envOrDefault("GEMINI_MODEL", "gemini-2.0-flash"),
			IsGemini: true,
		}
	}
	if k := os.Getenv("OPENROUTER_API_KEY"); k != "" {
		return &ProviderConfig{
			Name:     "openrouter",
			Endpoint: openRouterEndpoint,
			APIKey:   k,
			Model:    envOrDefault("GEMMA_MODEL", Gemma4CloudDefault),
		}
	}
	return nil
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
