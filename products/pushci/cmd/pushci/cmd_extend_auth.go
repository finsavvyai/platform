package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/finsavvyai/pushci/internal/entitlement"
)

// requireExtendEntitlement blocks pushci extend when the user is on the
// Free plan and has no AI-provider key set. BYO keys stay free; PushCI-
// managed AI counts against plan.
func requireExtendEntitlement(ctx context.Context) error {
	if hasAIProviderKey() {
		return nil
	}
	cfg := loadConfig()
	token := ""
	if cfg != nil {
		token = cfg.Token
	}
	r, err := entitlement.Check(ctx, token, entitlement.FeatureAIEdit)
	if err != nil {
		return fmt.Errorf("entitlement check: %w", err)
	}
	return entitlement.RequireErr(r)
}

func hasAIProviderKey() bool {
	keys := []string{"ANTHROPIC_API_KEY", "GROQ_API_KEY", "DEEPSEEK_API_KEY", "OPEN_AI_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"}
	for _, v := range keys {
		if os.Getenv(v) != "" {
			return true
		}
	}
	return false
}

func confirmExtend() bool {
	fmt.Print("\n  Apply these changes to pushci.yml? [y/N] ")
	var in string
	_, _ = fmt.Scanln(&in)
	return strings.EqualFold(strings.TrimSpace(in), "y")
}
