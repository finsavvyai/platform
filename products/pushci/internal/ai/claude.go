package ai

import (
	"os"
	"strings"
)

// NewClient auto-detects the best available provider from env vars.
// Priority (optimized for CI diagnose/heal latency): Groq → Anthropic
// → DeepSeek → OpenAI → Gemini. Users can force a provider via
// PUSHCI_AI_PROVIDER=<name>. If no key is set, returns an unconfigured
// Anthropic client so IsConfigured reports false and the caller falls
// through to the PushCI proxy or llamafile.
func NewClient() *Client {
	if forced := strings.ToLower(os.Getenv("PUSHCI_AI_PROVIDER")); forced != "" {
		if client, ok := forceProvider(forced); ok {
			return client
		}
	}
	if os.Getenv("GROQ_API_KEY") != "" {
		return newGroqClient()
	}
	if os.Getenv("ANTHROPIC_API_KEY") != "" {
		return newAnthropicClient()
	}
	if os.Getenv("DEEPSEEK_API_KEY") != "" {
		return newDeepSeekClient()
	}
	if os.Getenv("OPEN_AI_KEY") != "" || os.Getenv("OPENAI_API_KEY") != "" {
		return newOpenAIClient()
	}
	if os.Getenv("GEMINI_API_KEY") != "" {
		return newGeminiClient()
	}
	return newAnthropicClient()
}

// forceProvider returns the client for an explicit provider name.
// Used by PUSHCI_AI_PROVIDER to override the default priority.
func forceProvider(name string) (*Client, bool) {
	switch name {
	case "anthropic", "claude":
		return newAnthropicClient(), true
	case "groq":
		return newGroqClient(), true
	case "deepseek":
		return newDeepSeekClient(), true
	case "openai":
		return newOpenAIClient(), true
	case "gemini", "google":
		return newGeminiClient(), true
	}
	return nil, false
}
