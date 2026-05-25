package ingestion

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ICIJClient fetches offshore entity records from ICIJ Offshore Leaks.
type ICIJClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

// OffshoreRecord represents an entity from ICIJ offshore leaks.
type OffshoreRecord struct {
	Name                  string   `json:"name"`
	JurisdictionDescription string `json:"jurisdiction_description"`
	Countries             []string `json:"countries"`
	SourceID              string   `json:"source_id"`
	LinkedTo              []string `json:"linked_to"`
	DataSource            string   `json:"data_source"` // Panama Papers, Paradise Papers, Pandora Papers
}

// NewICIJClient creates a new ICIJ client.
func NewICIJClient(baseURL string, httpClient *http.Client) *ICIJClient {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	if baseURL == "" {
		baseURL = "https://offshoreleaks.icij.org/api"
	}
	return &ICIJClient{
		BaseURL:    baseURL,
		HTTPClient: httpClient,
	}
}

// SearchEntities searches for entities by name in offshore leaks databases.
func (c *ICIJClient) SearchEntities(name string) ([]OffshoreRecord, error) {
	if name == "" {
		return nil, fmt.Errorf("name required")
	}

	url := c.BaseURL + "/search/entities?q=" + name
	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body failed: %w", err)
	}

	var respWrapper struct {
		Results []OffshoreRecord `json:"results"`
	}
	if err := json.Unmarshal(data, &respWrapper); err != nil {
		var records []OffshoreRecord
		if err := json.Unmarshal(data, &records); err != nil {
			return nil, fmt.Errorf("json unmarshal failed: %w", err)
		}
		return records, nil
	}
	return respWrapper.Results, nil
}

// GetEntity fetches a specific offshore entity by ID.
func (c *ICIJClient) GetEntity(id string) (*OffshoreRecord, error) {
	if id == "" {
		return nil, fmt.Errorf("entity id required")
	}

	url := c.BaseURL + "/entities/" + id
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

	var record OffshoreRecord
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, fmt.Errorf("json unmarshal failed: %w", err)
	}

	return &record, nil
}
