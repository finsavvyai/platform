package main

import (
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/cli"
)

func isLocalFlag() bool {
	for _, a := range os.Args {
		if a == "--local" {
			return true
		}
	}
	return false
}

func getAIClient() (*ai.Client, error) {
	if isLocalFlag() || os.Getenv("PUSHCI_LOCAL") == "true" {
		return getLocalClient()
	}
	client := ai.NewClient()
	if client.IsConfigured() {
		// NewClient auto-detects in order: Anthropic → Groq → DeepSeek →
		// OpenAI → Gemini. Tell the user which one it picked so the CLI
		// output is honest about what backend is answering their questions.
		switch client.Provider() {
		case ai.ProviderAnthropic:
			cli.Info("Using Anthropic Claude (ANTHROPIC_API_KEY)")
		case ai.ProviderGroq:
			cli.Info("Using Groq Llama 3.3 70B (GROQ_API_KEY)")
		case ai.ProviderDeepSeek:
			cli.Info("Using DeepSeek (DEEPSEEK_API_KEY)")
		case ai.ProviderOpenAI:
			cli.Info("Using OpenAI gpt-4o-mini (OPEN_AI_KEY)")
		case ai.ProviderGemini:
			cli.Info("Using Gemini Flash (GEMINI_API_KEY)")
		}
		return client, nil
	}
	return getProxyClient()
}

func getLocalClient() (*ai.Client, error) {
	llama := ai.NewLlamafileClient()
	if llama.IsConfigured() {
		cli.Info("Using local llamafile (offline AI)")
		return ai.NewClientWithEndpoint("http://localhost:8080/v1/messages", "local"), nil
	}
	return nil, fmt.Errorf(
		"--local: llamafile not running at localhost:8080\n" +
			"  Start it: llamafile -m model.gguf --port 8080\n" +
			"  Download: https://github.com/mozilla-ai/llamafile",
	)
}

func getProxyClient() (*ai.Client, error) {
	token := os.Getenv("PUSHCI_TOKEN")
	if token == "" {
		if cfg := loadConfig(); cfg != nil && cfg.Token != "" {
			token = cfg.Token
		}
	}
	if token != "" {
		cli.Info("Using PushCI API (Pro plan)")
		return ai.NewClientWithModel("pushci-proxy"), nil
	}
	return nil, fmt.Errorf(
		"AI features require one of:\n" +
			"  1. Set ANTHROPIC_API_KEY   — highest quality diagnosis\n" +
			"  2. Set GROQ_API_KEY        — fastest latency, 30 req/min free\n" +
			"  3. Set DEEPSEEK_API_KEY    — cheapest OpenAI-compatible\n" +
			"  4. Set OPEN_AI_KEY         — gpt-4o-mini\n" +
			"  5. Set GEMINI_API_KEY      — Google 1500 req/day free\n" +
			"  6. Run " + cli.Blue("pushci login") + " for managed AI (Pro $9/mo)\n" +
			"  7. Use " + cli.Blue("--local") + " with llamafile for offline AI\n" +
			"  Upgrade at https://app.pushci.dev/billing",
	)
}
