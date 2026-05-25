package ingestion

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// EveryPoliticianClient fetches current officeholders from EveryPolitician.
type EveryPoliticianClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

// PoliticianRecord represents a politician from EveryPolitician API.
type PoliticianRecord struct {
	Name      string `json:"name"`
	Country   string `json:"country"`
	Party     string `json:"party"`
	Position  string `json:"position"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	Source    string `json:"source"`
}

// NewEveryPoliticianClient creates a new EveryPolitician client.
func NewEveryPoliticianClient(baseURL string, httpClient *http.Client) *EveryPoliticianClient {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	if baseURL == "" {
		baseURL = "https://api.everypolitician.org"
	}
	return &EveryPoliticianClient{
		BaseURL:    baseURL,
		HTTPClient: httpClient,
	}
}

// FetchPoliticians retrieves politicians for a given country.
func (c *EveryPoliticianClient) FetchPoliticians(country string) ([]PoliticianRecord, error) {
	if country == "" {
		return nil, fmt.Errorf("country required")
	}

	url := c.BaseURL + "/countries/" + country + "/legislators"
	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetch failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body failed: %w", err)
	}

	var records []PoliticianRecord
	if err := json.Unmarshal(data, &records); err != nil {
		return nil, fmt.Errorf("json unmarshal failed: %w", err)
	}

	return records, nil
}

// MapToPEPProfile converts a PoliticianRecord to a PEP profile for screening.
func (pr *PoliticianRecord) MapToPEPProfile(id string) domain.PEPProfile {
	tier := classifyPEPTierFromPosition(pr.Position)
	profile := domain.NewPEPProfile(id, tier, pr.Position, pr.Country)
	profile.ActiveFrom = pr.StartDate
	profile.ActiveTo = pr.EndDate
	profile.IsActive = pr.EndDate == ""
	return profile
}

func classifyPEPTierFromPosition(position string) domain.PEPTier {
	// Reuse existing classifier from opensanctions_pep_tier.go
	return classifyPEPTier(position, "")
}
