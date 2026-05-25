package ingestion

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

// PremiumClient extends base OpenSanctions client with premium API access.
type PremiumClient struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
	RateLimit  RateLimitStatus
}

// RateLimitStatus tracks API rate limit headers.
type RateLimitStatus struct {
	Remaining int
	Reset     time.Time
}

// PremiumRecord represents an enriched entity from OpenSanctions Premium.
type PremiumRecord struct {
	EntityID            string   `json:"entity_id"`
	Name                string   `json:"name"`
	Sanctions           []string `json:"sanctions"`
	Associations        []string `json:"associations"`
	SanctionsPrograms   []string `json:"sanctions_programs"`
	MediaMentions       int      `json:"media_mentions"`
	RiskScore           float64  `json:"risk_score"`
	LastModified        string   `json:"last_modified"`
	ConfidenceLevel     float64  `json:"confidence_level"`
}

// NewPremiumClient creates a new OpenSanctions Premium client.
func NewPremiumClient(baseURL, apiKey string, httpClient *http.Client) *PremiumClient {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	if baseURL == "" {
		baseURL = "https://api.opensanctions.org"
	}
	return &PremiumClient{
		BaseURL:    baseURL,
		APIKey:     apiKey,
		HTTPClient: httpClient,
	}
}

// FetchEnriched retrieves premium enriched data for an entity.
func (c *PremiumClient) FetchEnriched(entityID string) (*PremiumRecord, error) {
	if entityID == "" {
		return nil, fmt.Errorf("entity id required")
	}
	if c.APIKey == "" {
		return nil, fmt.Errorf("api key required")
	}

	url := c.BaseURL + "/v2/entities/" + entityID + "/premium"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("request creation failed: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if rl := resp.Header.Get("X-RateLimit-Remaining"); rl != "" {
		if rem, err := strconv.Atoi(rl); err == nil {
			c.RateLimit.Remaining = rem
		}
	}
	if rt := resp.Header.Get("X-RateLimit-Reset"); rt != "" {
		if reset, err := time.Parse(time.RFC3339, rt); err == nil {
			c.RateLimit.Reset = reset
		}
	}

	switch resp.StatusCode {
	case http.StatusNotFound:
		return nil, fmt.Errorf("entity not found")
	case http.StatusUnauthorized:
		return nil, fmt.Errorf("invalid api key")
	case http.StatusOK:
	default:
		return nil, fmt.Errorf("http %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body failed: %w", err)
	}

	var record PremiumRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, fmt.Errorf("json unmarshal failed: %w", err)
	}

	return &record, nil
}

// RateLimited checks if we're approaching the rate limit.
func (c *PremiumClient) RateLimited() bool {
	return c.RateLimit.Remaining < 10 && time.Now().Before(c.RateLimit.Reset)
}
