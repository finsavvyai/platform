package ingestion

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"os"
)

// h1Transport disables HTTP/2 so long downloads (800MB FTM feed) are
// not killed by h2 stream-level PROTOCOL_ERRORs when the starter
// cron's TLS stack lags on ping acks. HTTP/1.1 keep-alive is more
// tolerant of slow links on constrained pods.
var h1Transport = &http.Transport{
	TLSClientConfig:   &tls.Config{MinVersion: tls.VersionTLS12},
	ForceAttemptHTTP2: false,
	TLSNextProto:      map[string]func(string, *tls.Conn) http.RoundTripper{},
}

// FetchToDisk streams the URL body to a temp file and returns its
// path + ETag. Decouples network read from downstream consumer speed
// so slow parsers/upserts can't stall the HTTP socket and trigger
// server-side PROTOCOL_ERROR resets. Caller MUST os.Remove the path
// when done.
//
// Memory is bounded by a 1MB copy buffer regardless of source size,
// so this is safe for 800MB+ feeds on a 512MB cron pod. Trade-off:
// peak disk usage equals source size.
func (lf *ListFetcher) FetchToDisk(url string) (string, string, error) {
	if url == "" {
		return "", "", fmt.Errorf("url required")
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "AMLIQ/2.0 Sanctions Screening (compliance)")

	// Use an HTTP/1.1-only client for the large-file path — see
	// h1Transport comment for the rationale.
	h1Client := &http.Client{Timeout: lf.timeout, Transport: h1Transport}
	resp, err := h1Client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("http %d", resp.StatusCode)
	}

	f, err := os.CreateTemp("", "amliq-fetch-*.dat")
	if err != nil {
		return "", "", fmt.Errorf("tmpfile: %w", err)
	}
	defer f.Close()

	buf := make([]byte, 1<<20) // 1MB copy buffer
	if _, err := io.CopyBuffer(f, resp.Body, buf); err != nil {
		os.Remove(f.Name())
		return "", "", fmt.Errorf("copy body: %w", err)
	}
	return f.Name(), resp.Header.Get("ETag"), nil
}
