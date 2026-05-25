package ingestion

import (
	"fmt"
	"net/http"
)

// buildBrowserRequest creates an HTTP request that mimics Chrome.
func buildBrowserRequest(url string) (*http.Request, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("User-Agent",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) "+
			"AppleWebKit/537.36 (KHTML, like Gecko) "+
			"Chrome/131.0.0.0 Safari/537.36")
	req.Header.Set("Accept",
		"text/html,application/xhtml+xml,"+
			"application/xml;q=0.9,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language",
		"he,en-US;q=0.9,en;q=0.8,ar;q=0.7")
	req.Header.Set("Accept-Encoding", "gzip, deflate, br")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Sec-Ch-Ua",
		`"Chromium";v="131", "Not_A Brand";v="24"`)
	req.Header.Set("Sec-Ch-Ua-Mobile", "?0")
	req.Header.Set("Sec-Ch-Ua-Platform", `"Windows"`)
	req.Header.Set("Sec-Fetch-Dest", "document")
	req.Header.Set("Sec-Fetch-Mode", "navigate")
	req.Header.Set("Sec-Fetch-Site", "none")
	req.Header.Set("Sec-Fetch-User", "?1")
	req.Header.Set("Upgrade-Insecure-Requests", "1")
	return req, nil
}
