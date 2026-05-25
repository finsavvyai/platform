package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// FCAEnforcementParser fetches enforcement actions from UK FCA.
type FCAEnforcementParser struct {
	client *http.Client
}

func NewFCAEnforcementParser() *FCAEnforcementParser {
	return &FCAEnforcementParser{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

type fcaResult struct {
	Data []struct {
		Name       string `json:"name"`
		ActionType string `json:"action_type"`
		Date       string `json:"date"`
		Reference  string `json:"reference"`
		Summary    string `json:"summary"`
	} `json:"data"`
}

// Search queries FCA for enforcement outcomes.
func (p *FCAEnforcementParser) Search(
	ctx context.Context, entityName string, limit int,
) ([]domain.EnforcementAction, error) {
	if limit <= 0 {
		limit = 20
	}
	u := fmt.Sprintf(
		"https://register.fca.org.uk/services/V0.1/Enforcement?q=%s&limit=%d",
		url.QueryEscape(entityName), limit,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fca api: %w", err)
	}
	defer resp.Body.Close()

	var result fcaResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("fca decode: %w", err)
	}

	var actions []domain.EnforcementAction
	for _, item := range result.Data {
		actionType := mapFCAActionType(item.ActionType)
		action, _ := domain.NewEnforcementAction(
			item.Name, "FCA", actionType,
			time.Now(), item.Summary,
			"https://register.fca.org.uk/s/firm?ref="+item.Reference, "UK",
		)
		actions = append(actions, action)
	}
	return actions, nil
}

func mapFCAActionType(s string) domain.EnforcementActionType {
	switch s {
	case "fine", "financial_penalty":
		return domain.ActionFine
	case "prohibition", "ban":
		return domain.ActionBan
	default:
		return domain.ActionWarning
	}
}
