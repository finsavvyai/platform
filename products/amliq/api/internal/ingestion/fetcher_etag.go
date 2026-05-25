package ingestion

import (
	"fmt"
	"io"
	"net/http"
)

// FetchWithETag fetches a URL with conditional ETag support.
// Returns nil data if server responds 304 Not Modified.
// Israeli gov URLs automatically use browser bypass (no ETag support).
func (lf *ListFetcher) FetchWithETag(url, previousETag string) ([]byte, string, error) {
	if url == "" {
		return nil, "", fmt.Errorf("url required")
	}

	// Israeli gov sites need browser bypass — ETag not supported
	if isIsraeliGovDomain(url) {
		data, err := FetchIsraeliGov(url)
		if err != nil {
			return nil, "", err
		}
		return data, "", nil
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, "", fmt.Errorf("create request: %w", err)
	}

	if previousETag != "" {
		req.Header.Set("If-None-Match", previousETag)
	}

	resp, err := lf.client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("fetch: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotModified {
		return nil, previousETag, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("http %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("read body: %w", err)
	}

	etag := resp.Header.Get("ETag")
	return data, etag, nil
}
