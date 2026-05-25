package ingestion

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

// FetchStreamWithETag is the streaming counterpart to FetchWithETag.
// Returns an io.ReadCloser the caller MUST Close(). On 304 the
// ReadCloser is nil and the etag echoes the previous value.
//
// Israeli gov URLs still route through the browser-bypass helper,
// which returns a fully-buffered []byte — there's nothing to stream
// there so we wrap it in a bytes.Reader to keep the return contract.
func (lf *ListFetcher) FetchStreamWithETag(
	url, previousETag string,
) (io.ReadCloser, string, error) {
	if url == "" {
		return nil, "", fmt.Errorf("url required")
	}

	if isIsraeliGovDomain(url) {
		data, err := FetchIsraeliGov(url)
		if err != nil {
			return nil, "", err
		}
		return io.NopCloser(bytes.NewReader(data)), "", nil
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

	if resp.StatusCode == http.StatusNotModified {
		resp.Body.Close()
		return nil, previousETag, nil
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, "", fmt.Errorf("http %d", resp.StatusCode)
	}

	return resp.Body, resp.Header.Get("ETag"), nil
}
