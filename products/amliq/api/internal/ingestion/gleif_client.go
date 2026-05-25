package ingestion

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

// GLEIFClient is a thin read-only HTTP wrapper around the GLEIF
// LEI lookup API. Used by entity-resolution paths that want to
// enrich a company name with its official LEI.
type GLEIFClient struct {
	httpClient *http.Client
	baseURL    string
}

// NewGLEIFClient constructs a client with the given HTTP client
// (nil uses the default). Defaults to api.gleif.org.
func NewGLEIFClient(c *http.Client) *GLEIFClient {
	if c == nil {
		c = &http.Client{}
	}
	return &GLEIFClient{httpClient: c, baseURL: "https://api.gleif.org"}
}

// LookupLEI returns the first matching LEI record for the given
// legal name. Returns an error when the API returns non-200 or
// when no records match.
func (c *GLEIFClient) LookupLEI(ctx context.Context, name string) (LEIRecord, error) {
	q := url.QueryEscape(name)
	endpoint := fmt.Sprintf(
		"%s/api/v1/lei-records?filter%%5Blegal-name%%5D=%s",
		c.baseURL, q)

	req, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if err != nil {
		return LEIRecord{}, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return LEIRecord{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return LEIRecord{}, fmt.Errorf("gleif api: status %d", resp.StatusCode)
	}

	var result gleifResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return LEIRecord{}, err
	}
	if len(result.Data) == 0 {
		return LEIRecord{}, fmt.Errorf("no lei records found")
	}
	r := result.Data[0]
	return LEIRecord{LEI: r.ID, LegalName: r.Attributes.Entity.LegalName.Name}, nil
}
