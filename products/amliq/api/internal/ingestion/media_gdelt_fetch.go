package ingestion

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// gdeltLastUpdateURL points to the GDELT 2.0 manifest. Format per
// line is `<size> <md5> <url>` and the third row is the GKG export.
// Verified live 2026-04-29.
const gdeltLastUpdateURL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"

// FetchLatestGKG downloads, unzips, and parses the most recent GDELT
// GKG export (~8 MB). Returns AML-relevant articles only — non-AML
// rows are dropped during parsing so the caller never sees them.
func FetchLatestGKG(ctx context.Context) ([]GDELTArticle, error) {
	url, err := latestGKGURL(ctx)
	if err != nil {
		return nil, err
	}
	body, err := httpGet(ctx, url, 90*time.Second)
	if err != nil {
		return nil, fmt.Errorf("download gkg: %w", err)
	}
	csv, err := unzipFirst(body)
	if err != nil {
		return nil, fmt.Errorf("unzip gkg: %w", err)
	}
	return NewGDELTParser().Parse(csv), nil
}

func latestGKGURL(ctx context.Context) (string, error) {
	body, err := httpGet(ctx, gdeltLastUpdateURL, 15*time.Second)
	if err != nil {
		return "", fmt.Errorf("manifest: %w", err)
	}
	for _, line := range strings.Split(string(body), "\n") {
		if strings.Contains(line, ".gkg.csv.zip") {
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				return parts[2], nil
			}
		}
	}
	return "", fmt.Errorf("gkg url missing from manifest")
}

func httpGet(ctx context.Context, url string, t time.Duration) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: t}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

func unzipFirst(zipBody []byte) ([]byte, error) {
	zr, err := zip.NewReader(bytes.NewReader(zipBody), int64(len(zipBody)))
	if err != nil {
		return nil, err
	}
	if len(zr.File) == 0 {
		return nil, fmt.Errorf("empty zip")
	}
	rc, err := zr.File[0].Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(rc)
}
