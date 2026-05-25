package main

import (
	"os"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
)

// providerKeyEnvVars lists every env var that unlocks the AI feature gate.
// The order here doesn't determine selection priority — that's handled in
// ai.NewClient(). This is just "any of these counts as a valid BYOK key".
var providerKeyEnvVars = []string{
	"ANTHROPIC_API_KEY",
	"GROQ_API_KEY",
	"DEEPSEEK_API_KEY",
	"OPEN_AI_KEY",
	"OPENAI_API_KEY",
	"GEMINI_API_KEY",
}

// detectedProviderKey returns the name of the first provider env var that
// is set, or "" if none are. Used only for the "Using your own X" warning.
func detectedProviderKey() string {
	for _, name := range providerKeyEnvVars {
		if os.Getenv(name) != "" {
			return name
		}
	}
	return ""
}

// requireProFeature checks if the user has a Pro/Team plan or their own
// AI provider key. Accepts Anthropic, Groq, DeepSeek, OpenAI, or Gemini.
// Returns true if the feature is allowed.
func requireProFeature(feature string) bool {
	if key := detectedProviderKey(); key != "" {
		cfg := loadConfig()
		if cfg == nil || !isProPlan(cfg.Plan) {
			cli.Warn("Using your own " + key + " on free plan for " + feature)
			cli.Info("Upgrade to Pro for managed AI: " + cli.Blue("https://app.pushci.dev/billing"))
		}
		return true
	}

	cfg := loadConfig()
	if cfg != nil && isProPlan(cfg.Plan) {
		return true
	}

	cli.Error("AI features require PushCI Pro or your own AI provider key.")
	cli.Info("  Upgrade: " + cli.Blue("https://app.pushci.dev/billing"))
	cli.Info("  Or set any of:")
	cli.Info("    ANTHROPIC_API_KEY  — highest quality")
	cli.Info("    GROQ_API_KEY       — fastest, 30 req/min free")
	cli.Info("    DEEPSEEK_API_KEY   — cheapest")
	cli.Info("    OPEN_AI_KEY        — gpt-4o-mini")
	cli.Info("    GEMINI_API_KEY     — 1500 req/day free")
	cli.Info("  Or run:  " + cli.Blue("pushci login"))
	return false
}

func isProPlan(plan string) bool {
	p := strings.ToLower(plan)
	return p == "pro" || p == "team"
}
