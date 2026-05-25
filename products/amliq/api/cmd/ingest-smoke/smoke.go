package main

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/aegis-aml/aegis/internal/ingestion"
)

func smoke(
	ctx context.Context, client *http.Client,
	tr *ingestion.TypeRegistry, t target,
) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, t.url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("User-Agent", "amliq-smoke/1.0")
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("http %d", resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}
	p, err := tr.Get(t.parser)
	if err != nil {
		return 0, err
	}
	ents, err := p.Parse(data)
	if err != nil {
		return 0, err
	}
	return len(ents), nil
}
