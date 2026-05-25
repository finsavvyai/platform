package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// AIClient abstracts an LLM API for entity extraction.
type AIClient interface {
	Complete(ctx context.Context, prompt string) (string, error)
}

// AdverseMediaFetcher uses AI to extract entity names from news text.
type AdverseMediaFetcher struct {
	ai AIClient
}

// NewAdverseMediaFetcher creates a new fetcher with the given AI client.
func NewAdverseMediaFetcher(ai AIClient) *AdverseMediaFetcher {
	return &AdverseMediaFetcher{ai: ai}
}

type extractedEntity struct {
	Name string `json:"name"`
	Type string `json:"type"`
	Role string `json:"role"`
}

const extractPrompt = `Extract person/org names relevant to AML/CFT. Return JSON array: name, type (person/organization), role.
Article: %s`

// DiscoverEntities extracts AML-relevant entities from news text.
func (f *AdverseMediaFetcher) DiscoverEntities(
	ctx context.Context, newsText string,
) ([]domain.Entity, error) {
	if newsText == "" {
		return nil, fmt.Errorf("empty news text")
	}
	prompt := fmt.Sprintf(extractPrompt, truncate(newsText, 4000))
	resp, err := f.ai.Complete(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("ai extraction: %w", err)
	}
	return parseAIResponse(resp)
}

func parseAIResponse(resp string) ([]domain.Entity, error) {
	resp = strings.TrimSpace(resp)
	start := strings.Index(resp, "[")
	end := strings.LastIndex(resp, "]")
	if start < 0 || end < 0 || end <= start {
		return nil, fmt.Errorf("no JSON array in AI response")
	}
	var extracted []extractedEntity
	if err := json.Unmarshal([]byte(resp[start:end+1]), &extracted); err != nil {
		return nil, fmt.Errorf("parse AI JSON: %w", err)
	}
	var entities []domain.Entity
	for _, e := range extracted {
		ent, err := buildMediaEntity(e)
		if err != nil {
			continue
		}
		entities = append(entities, ent)
	}
	return entities, nil
}

func buildMediaEntity(e extractedEntity) (domain.Entity, error) {
	id, err := domain.NewEntityID(sanitizeBulkID("media-" + e.Name))
	if err != nil {
		return domain.Entity{}, err
	}
	name, err := domain.NewName(e.Name, "", "", "")
	if err != nil {
		return domain.Entity{}, err
	}
	typ := domain.EntityTypeIndividual
	if strings.EqualFold(e.Type, "organization") {
		typ = domain.EntityTypeCompany
	}
	ent, err := domain.NewEntity(id, typ, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, err
	}
	ent.ListID = "adverse_media"
	ent.Metadata["role"] = e.Role
	setAdverseMediaFields(&ent, e, typ)
	return ent, nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}
