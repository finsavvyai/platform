package ingestion

import (
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"time"
)

// BrowserFetch fetches a URL mimicking a real browser.
// Bypasses basic bot detection (User-Agent, Accept headers).
func BrowserFetch(url string) ([]byte, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	req, err := buildBrowserRequest(url)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	return body, nil
}

// SessionFetch establishes a session on the site first (gets cookies),
// then fetches the target page. Mimics real browser navigation flow.
func SessionFetch(baseURL, targetURL string) ([]byte, error) {
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Timeout: 60 * time.Second, Jar: jar}

	// Step 1: visit base page to get session cookies
	homeReq, err := buildBrowserRequest(baseURL)
	if err != nil {
		return nil, fmt.Errorf("session home req: %w", err)
	}
	homeResp, err := client.Do(homeReq)
	if err != nil {
		return nil, fmt.Errorf("session home: %w", err)
	}
	homeResp.Body.Close()

	// Step 2: fetch target with session cookies + Referer
	req, err := buildBrowserRequest(targetURL)
	if err != nil {
		return nil, fmt.Errorf("session target req: %w", err)
	}
	req.Header.Set("Referer", baseURL)
	req.Header.Set("Sec-Fetch-Site", "same-origin")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("session target: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, targetURL)
	}
	return io.ReadAll(resp.Body)
}
