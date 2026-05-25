package ingestion

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type ListFetcher struct {
	client  *http.Client
	timeout time.Duration
}

func NewListFetcher(timeout time.Duration) *ListFetcher {
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	return &ListFetcher{
		client:  &http.Client{Timeout: timeout},
		timeout: timeout,
	}
}

func (lf *ListFetcher) Fetch(url string) ([]byte, string, error) {
	if url == "" {
		return nil, "", fmt.Errorf("url required")
	}

	// Israeli gov sites block standard HTTP clients — use browser bypass
	if isIsraeliGovDomain(url) {
		data, err := FetchIsraeliGov(url)
		if err != nil {
			return nil, "", err
		}
		return data, "", nil
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", "AMLIQ/2.0 Sanctions Screening (compliance)")
	req.Header.Set("Accept", "text/csv,application/xml,application/json,*/*")

	resp, err := lf.client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("fetch failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("http %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("read failed: %w", err)
	}

	etag := resp.Header.Get("ETag")

	// Auto-extract ZIP files (e.g., ICIJ data)
	if strings.HasSuffix(url, ".zip") {
		extracted, err := extractFirstCSVFromZip(data)
		if err == nil && len(extracted) > 0 {
			return extracted, etag, nil
		}
	}

	return data, etag, nil
}

// extractFirstCSVFromZip finds the first CSV in a ZIP archive.
func extractFirstCSVFromZip(data []byte) ([]byte, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, err
	}
	for _, f := range r.File {
		if strings.HasSuffix(f.Name, ".csv") {
			rc, err := f.Open()
			if err != nil {
				continue
			}
			content, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				continue
			}
			return content, nil
		}
	}
	return nil, fmt.Errorf("no csv in zip")
}
