package litellm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"
)

// httpClient is a thin HTTP client around the LiteLLM proxy.
// It owns the base URL, master-key auth, and timeouts.
// Streaming uses a separate long-lived request (see streaming.go).
type httpClient struct {
	baseURL   string
	masterKey string
	http      *http.Client
}

// newHTTPClient builds an httpClient from explicit values or env fallbacks:
//   - LITELLM_PROXY_URL (default "http://localhost:4000")
//   - LITELLM_MASTER_KEY (required at request time; empty allowed for dev)
func newHTTPClient(baseURL, masterKey string, timeout time.Duration) *httpClient {
	if baseURL == "" {
		baseURL = os.Getenv("LITELLM_PROXY_URL")
	}
	if baseURL == "" {
		baseURL = "http://localhost:4000"
	}
	if masterKey == "" {
		masterKey = os.Getenv("LITELLM_MASTER_KEY")
	}
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	return &httpClient{
		baseURL:   baseURL,
		masterKey: masterKey,
		http:      &http.Client{Timeout: timeout},
	}
}

// do issues an HTTP request, sets auth headers, and returns the response.
// Caller is responsible for closing resp.Body on the success path.
func (c *httpClient) do(ctx context.Context, method, path string, body any, stream bool) (*http.Response, error) {
	var rdr io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("litellm: marshal request: %w", err)
		}
		rdr = bytes.NewReader(buf)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, rdr)
	if err != nil {
		return nil, fmt.Errorf("litellm: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.masterKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.masterKey)
	}
	if stream {
		req.Header.Set("Accept", "text/event-stream")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("litellm: request failed: %w", err)
	}
	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		return nil, fmt.Errorf("litellm: %s returned %d: %s", path, resp.StatusCode, string(b))
	}
	return resp, nil
}

// costFromHeaders reads LiteLLM's `x-litellm-response-cost` header.
// Returns 0 when the header is missing or unparseable — the proxy only
// emits it when cost tracking is enabled and the upstream model is known.
func costFromHeaders(h http.Header) float64 {
	raw := h.Get("x-litellm-response-cost")
	if raw == "" {
		return 0
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0
	}
	return v
}

// modelFromHeaders returns the upstream model id LiteLLM actually routed to
// (may differ from the requested alias after fallback).
func modelFromHeaders(h http.Header, fallback string) string {
	if id := h.Get("x-litellm-model-id"); id != "" {
		return id
	}
	return fallback
}
