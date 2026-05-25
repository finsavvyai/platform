package ingestion

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ResilientFetcher wraps HTTP fetching with retry and circuit breaker.
type ResilientFetcher struct {
	client  *http.Client
	retries int
	backoff time.Duration
	breaker *CircuitBreaker
}

// NewResilientFetcher creates a fault-tolerant HTTP fetcher.
func NewResilientFetcher() *ResilientFetcher {
	return &ResilientFetcher{
		client:  &http.Client{Timeout: 30 * time.Second},
		retries: 3,
		backoff: 1 * time.Second,
		breaker: NewCircuitBreaker(5, 5*time.Minute),
	}
}

// Fetch retrieves url with retry, circuit breaker, and ETag support.
func (rf *ResilientFetcher) Fetch(ctx context.Context, url string) ([]byte, string, error) {
	if rf.breaker.IsOpen() {
		return nil, "", fmt.Errorf("circuit breaker open for %s", url)
	}
	var lastErr error
	for attempt := 0; attempt < rf.retries; attempt++ {
		if attempt > 0 {
			wait := rf.backoff * (1 << (attempt - 1))
			select {
			case <-ctx.Done():
				return nil, "", ctx.Err()
			case <-time.After(wait):
			}
		}
		data, etag, err := rf.doFetch(ctx, url)
		if err == nil {
			rf.breaker.reset()
			return data, etag, nil
		}
		lastErr = err
	}
	rf.breaker.recordFailure()
	return nil, "", fmt.Errorf("fetch failed after %d retries: %w", rf.retries, lastErr)
}

func (rf *ResilientFetcher) doFetch(ctx context.Context, url string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", "AMLIQ/2.0 (sanctions-screening)")
	resp, err := rf.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotModified {
		return nil, resp.Header.Get("ETag"), nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("http %d", resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	return data, resp.Header.Get("ETag"), err
}
