package screening

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// LLMClient abstracts the LLM API for classification.
type LLMClient interface {
	Complete(ctx context.Context, prompt string) (string, error)
}

// MediaClassifier uses AI to categorize adverse media articles.
type MediaClassifier struct {
	llm LLMClient
}

func NewMediaClassifier(llm LLMClient) *MediaClassifier {
	return &MediaClassifier{llm: llm}
}

// ClassificationResult holds the AI's assessment of an article.
type ClassificationResult struct {
	Categories []domain.MediaCategory `json:"categories"`
	Severity   int                    `json:"severity"`
	Entities   []string               `json:"entities"`
	Confirmed  bool                   `json:"confirmed"`
	Summary    string                 `json:"summary"`
}

// Classify analyzes an article and returns risk classification.
func (mc *MediaClassifier) Classify(
	ctx context.Context, title, content, source string,
) (*ClassificationResult, error) {
	prompt := buildClassifyPrompt(title, content, source)
	resp, err := mc.llm.Complete(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("LLM classification: %w", err)
	}
	return parseClassification(resp)
}

func buildClassifyPrompt(title, content, source string) string {
	return fmt.Sprintf(`Classify this article for AML/CFT risk.
Title: %s
Source: %s
Content: %.500s

Return JSON: {"categories":["money_laundering"],"severity":1-10,"entities":["name"],"confirmed":true/false,"summary":"..."}`,
		title, source, content)
}

func parseClassification(resp string) (*ClassificationResult, error) {
	resp = extractJSON(resp)
	var result ClassificationResult
	if err := json.Unmarshal([]byte(resp), &result); err != nil {
		return nil, fmt.Errorf("parse classification: %w", err)
	}
	if result.Severity < 1 || result.Severity > 10 {
		result.Severity = 5
	}
	return &result, nil
}

func extractJSON(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}
