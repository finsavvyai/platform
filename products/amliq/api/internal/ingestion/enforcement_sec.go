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

// SECEnforcementParser fetches enforcement actions from SEC EDGAR.
type SECEnforcementParser struct {
	client *http.Client
}

func NewSECEnforcementParser() *SECEnforcementParser {
	return &SECEnforcementParser{
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

type secSearchResult struct {
	Hits struct {
		Hits []struct {
			Source struct {
				DisplayNames []string `json:"display_date_dt"`
				EntityName   string   `json:"entity_name"`
				FileDate     string   `json:"file_date"`
				FormType     string   `json:"form_type"`
				FileURL      string   `json:"file_url"`
			} `json:"_source"`
		} `json:"hits"`
	} `json:"hits"`
}

// Search queries SEC EDGAR for enforcement actions matching a name.
func (p *SECEnforcementParser) Search(
	ctx context.Context, entityName string, limit int,
) ([]domain.EnforcementAction, error) {
	if limit <= 0 {
		limit = 20
	}
	u := fmt.Sprintf(
		"https://efts.sec.gov/LATEST/search-index?q=%s&dateRange=custom&startdt=2020-01-01&forms=AAER,LR&from=0&size=%d",
		url.QueryEscape(entityName), limit,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "AMLIQ/1.0")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sec edgar: %w", err)
	}
	defer resp.Body.Close()

	var result secSearchResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("sec decode: %w", err)
	}

	var actions []domain.EnforcementAction
	for _, hit := range result.Hits.Hits {
		action, _ := domain.NewEnforcementAction(
			hit.Source.EntityName, "SEC", domain.ActionFine,
			time.Now(), hit.Source.FormType,
			"https://www.sec.gov"+hit.Source.FileURL, "US",
		)
		actions = append(actions, action)
	}
	return actions, nil
}
