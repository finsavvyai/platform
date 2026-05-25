package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// WikidataPEPFetcher queries Wikidata SPARQL for PEP profiles.
type WikidataPEPFetcher struct {
	client  *http.Client
	limiter *DownloadLimiter
}

// NewWikidataPEPFetcher creates a fetcher with rate limiting.
func NewWikidataPEPFetcher() *WikidataPEPFetcher {
	return &WikidataPEPFetcher{
		client:  &http.Client{Timeout: 60 * time.Second},
		limiter: NewDownloadLimiter(1100 * time.Millisecond),
	}
}

// FetchPEPs queries Wikidata for all PEPs in a given country.
func (f *WikidataPEPFetcher) FetchPEPs(
	ctx context.Context, country string,
) ([]domain.PEPProfile, error) {
	qid := GetQID(country)
	if qid == "" {
		return nil, fmt.Errorf("unknown country code: %s", country)
	}
	query := pepQuery(qid)
	results, err := f.executeSPARQL(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("sparql query for %s: %w", country, err)
	}
	return parsePEPResults(results, country), nil
}

// executeSPARQL sends a SPARQL query and returns raw JSON bindings.
func (f *WikidataPEPFetcher) executeSPARQL(
	ctx context.Context, query string,
) (sparqlResponse, error) {
	f.limiter.Wait()
	u := sparqlEndpoint + "?query=" + url.QueryEscape(query) +
		"&format=json"
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return sparqlResponse{}, err
	}
	req.Header.Set("User-Agent", "AMLIQ/2.0 (AML screening)")
	req.Header.Set("Accept", "application/sparql-results+json")
	resp, err := f.client.Do(req)
	if err != nil {
		return sparqlResponse{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return sparqlResponse{}, fmt.Errorf("http %d: %s",
			resp.StatusCode, string(body[:min(len(body), 200)]))
	}
	var result sparqlResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return sparqlResponse{}, fmt.Errorf("decode: %w", err)
	}
	return result, nil
}

func parsePEPResults(
	resp sparqlResponse, country string,
) []domain.PEPProfile {
	var profiles []domain.PEPProfile
	seen := make(map[string]bool)
	for _, b := range resp.Results.Bindings {
		qid := extractQID(b.Value("person"))
		if qid == "" || seen[qid] {
			continue
		}
		seen[qid] = true
		position := b.Value("positionLabel")
		tier := classifyTier(position)
		p := domain.NewPEPProfile(qid, tier, position, country)
		p.ActiveFrom = b.Value("dob")
		profiles = append(profiles, p)
	}
	return profiles
}
