package screening

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

type scanResponse struct {
	Hits []struct {
		Title      string   `json:"title"`
		Source     string   `json:"source"`
		Snippet    string   `json:"snippet"`
		Categories []string `json:"categories"`
		RiskScore  float64  `json:"risk_score"`
	} `json:"hits"`
	Summary string `json:"summary"`
}

func parseScanResults(resp, entityName string) ([]domain.MediaHit, error) {
	raw := extractJSON(resp)
	var sr scanResponse
	if err := json.Unmarshal([]byte(raw), &sr); err != nil {
		return nil, fmt.Errorf("parse scan: %w", err)
	}
	hits := make([]domain.MediaHit, 0, len(sr.Hits))
	for _, h := range sr.Hits {
		cats := toMediaCategories(h.Categories)
		hit, err := domain.NewMediaHit(
			entityName, h.Source, "", h.Title, h.Snippet, cats, h.RiskScore,
		)
		if err != nil {
			continue
		}
		hits = append(hits, hit)
	}
	return hits, nil
}

type articleResponse struct {
	Categories []string `json:"categories"`
	RiskScore  float64  `json:"risk_score"`
}

func parseArticleResult(resp string) ([]domain.MediaCategory, float64, error) {
	raw := extractJSON(resp)
	var ar articleResponse
	if err := json.Unmarshal([]byte(raw), &ar); err != nil {
		return nil, 0, fmt.Errorf("parse article: %w", err)
	}
	return toMediaCategories(ar.Categories), ar.RiskScore, nil
}

func toMediaCategories(raw []string) []domain.MediaCategory {
	cats := make([]domain.MediaCategory, 0, len(raw))
	for _, r := range raw {
		cats = append(cats, domain.MediaCategory(strings.ToLower(r)))
	}
	return cats
}
