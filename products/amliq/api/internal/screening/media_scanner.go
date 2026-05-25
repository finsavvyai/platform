package screening

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// MediaScanner uses AI to scan entities for adverse media.
type MediaScanner struct {
	llm LLMClient
}

// NewMediaScanner creates a scanner with an AI client.
func NewMediaScanner(llm LLMClient) *MediaScanner {
	return &MediaScanner{llm: llm}
}

// ScanResult holds the AI analysis of an entity's media presence.
type ScanResult struct {
	Hits    []domain.MediaHit `json:"hits"`
	Summary string            `json:"summary"`
}

// ScanEntity searches and analyzes news about an entity.
func (ms *MediaScanner) ScanEntity(
	ctx context.Context, name string,
) ([]domain.MediaHit, error) {
	prompt := buildScanPrompt(name)
	resp, err := ms.llm.Complete(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("media scan: %w", err)
	}
	return parseScanResults(resp, name)
}

// ClassifyArticle classifies an article for AML risk categories.
func (ms *MediaScanner) ClassifyArticle(
	ctx context.Context, title, snippet string,
) ([]domain.MediaCategory, float64, error) {
	prompt := buildArticlePrompt(title, snippet)
	resp, err := ms.llm.Complete(ctx, prompt)
	if err != nil {
		return nil, 0, fmt.Errorf("classify article: %w", err)
	}
	return parseArticleResult(resp)
}

func buildScanPrompt(name string) string {
	return fmt.Sprintf(`Analyze this entity for adverse media risk.
Entity: %s
Return JSON: {"hits":[{"title":"...","source":"...","snippet":"...","categories":["fraud"],"risk_score":0.0-1.0}],"summary":"..."}
Only include genuinely adverse findings.`, name)
}

func buildArticlePrompt(title, snippet string) string {
	return fmt.Sprintf(`Classify this article for AML/CFT risk.
Title: %s
Snippet: %.300s
Return JSON: {"categories":["money_laundering"],"risk_score":0.0-1.0}`, title, snippet)
}

