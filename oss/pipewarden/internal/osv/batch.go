package osv

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// BatchEndpoint is the OSV.dev batch query endpoint.
const BatchEndpoint = "https://api.osv.dev/v1/querybatch"

// PackageQuery identifies a package version to look up.
type PackageQuery struct {
	Ecosystem Ecosystem
	Name      string
	Version   string
}

type batchRequest struct {
	Queries []batchQuery `json:"queries"`
}

type batchQuery struct {
	Package batchPackage `json:"package"`
	Version string       `json:"version"`
}

type batchPackage struct {
	Name      string `json:"name"`
	Ecosystem string `json:"ecosystem"`
}

type batchResponse struct {
	Results []batchResult `json:"results"`
}

type batchResult struct {
	Vulns []Vulnerability `json:"vulns"`
}

// QueryBatch looks up vulnerabilities for many package versions in one request.
// Result order matches the input query order.
func (c *Client) QueryBatch(ctx context.Context, queries []PackageQuery) ([][]Vulnerability, error) {
	if len(queries) == 0 {
		return nil, nil
	}
	payload := batchRequest{Queries: make([]batchQuery, len(queries))}
	for i, q := range queries {
		if q.Name == "" {
			return nil, fmt.Errorf("osv: package name required at index %d", i)
		}
		payload.Queries[i] = batchQuery{
			Package: batchPackage{
				Name:      q.Name,
				Ecosystem: string(q.Ecosystem),
			},
			Version: q.Version,
		}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("osv: marshal batch: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpointForBatch(), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("osv: build batch request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("osv: http batch: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		excerpt, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("osv: batch status %d: %s", resp.StatusCode, string(excerpt))
	}
	var out batchResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("osv: decode batch: %w", err)
	}
	results := make([][]Vulnerability, len(queries))
	for i := range queries {
		if i < len(out.Results) {
			results[i] = out.Results[i].Vulns
		}
	}
	return results, nil
}

func (c *Client) endpointForBatch() string {
	if c.endpoint == DefaultEndpoint {
		return BatchEndpoint
	}
	return c.endpoint
}
