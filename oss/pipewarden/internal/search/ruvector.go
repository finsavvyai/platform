// Package search provides a thin HTTP client for RuVector — an external
// hybrid (BM25 + vector) search service used to power the "similar
// findings" endpoint. When PIPEWARDEN_RUVECTOR_URL is unset, the client
// becomes a no-op: Index returns nil, Similar returns an empty slice.
// This keeps the Community tier functional without a sidecar.
package search

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const (
	envURL        = "PIPEWARDEN_RUVECTOR_URL"
	envAPIKey     = "PIPEWARDEN_RUVECTOR_APIKEY"
	envCollection = "PIPEWARDEN_RUVECTOR_COLLECTION"
	defaultColl   = "findings"
)

// FindingDoc is the indexable shape of a finding for RuVector.
type FindingDoc struct {
	ID        int64             `json:"id"`
	Title     string            `json:"title"`
	Message   string            `json:"message"`
	Severity  string            `json:"severity"`
	Category  string            `json:"category"`
	CodePath  string            `json:"code_path,omitempty"`
	CodeBlob  string            `json:"code_blob,omitempty"`
	Meta      map[string]string `json:"meta,omitempty"`
	CreatedAt time.Time         `json:"created_at"`
}

// Hit is a single similar-finding result.
type Hit struct {
	ID    int64   `json:"id"`
	Score float64 `json:"score"`
	Title string  `json:"title"`
	Why   string  `json:"why,omitempty"`
}

// Client is a ruvector HTTP client. Zero value is an inert no-op.
type Client struct {
	url        string
	apiKey     string
	collection string
	http       *http.Client
}

// New constructs a Client from env vars. If PIPEWARDEN_RUVECTOR_URL is
// blank, the returned client is inert — its methods succeed trivially.
func New() *Client {
	return &Client{
		url:        os.Getenv(envURL),
		apiKey:     os.Getenv(envAPIKey),
		collection: firstNonEmpty(os.Getenv(envCollection), defaultColl),
		http:       &http.Client{Timeout: 5 * time.Second},
	}
}

// Enabled reports whether the client is wired to a live ruvector endpoint.
func (c *Client) Enabled() bool { return c != nil && c.url != "" }

// Index sends a finding for embedding + indexing. No-op when disabled.
func (c *Client) Index(ctx context.Context, doc FindingDoc) error {
	if !c.Enabled() {
		return nil
	}
	body, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("ruvector: marshal: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		fmt.Sprintf("%s/collections/%s/docs", c.url, c.collection), bytes.NewReader(body))
	if err != nil {
		return err
	}
	c.applyAuth(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("ruvector: index: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ruvector: index HTTP %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

// Similar returns the top-k findings structurally/semantically closest to
// findingID. Returns an empty slice when disabled.
func (c *Client) Similar(ctx context.Context, findingID int64, k int) ([]Hit, error) {
	if !c.Enabled() {
		return []Hit{}, nil
	}
	if k <= 0 || k > 50 {
		return nil, errors.New("ruvector: k must be 1..50")
	}
	payload := map[string]interface{}{"id": findingID, "k": k}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		fmt.Sprintf("%s/collections/%s/similar", c.url, c.collection), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ruvector: similar: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ruvector: similar HTTP %d: %s", resp.StatusCode, string(b))
	}
	var out struct {
		Hits []Hit `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("ruvector: decode: %w", err)
	}
	return out.Hits, nil
}

func (c *Client) applyAuth(req *http.Request) {
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
