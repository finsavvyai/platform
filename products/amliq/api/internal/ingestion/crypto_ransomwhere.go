package ingestion

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ransomwhereResponse mirrors the public api.ransomwhe.re/export
// payload. Verified live 2026-04-29: ~5.5MB JSON, BTC-dominant.
type ransomwhereResponse struct {
	Result []struct {
		Address    string `json:"address"`
		Blockchain string `json:"blockchain"`
	} `json:"result"`
}

// FetchRansomwhere pulls the public ransomware wallet tracker.
// Each entry already includes a blockchain tag; we map the lower-
// case label ("bitcoin") to a chain code ("BTC"). Unknown chains
// pass through as the upstream label uppercased.
func FetchRansomwhere(src CryptoSource) ([]domain.CryptoEntry, error) {
	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Get(src.URL)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", src.ID, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("fetch %s: HTTP %d", src.ID, resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", src.ID, err)
	}
	var doc ransomwhereResponse
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("parse %s: %w", src.ID, err)
	}
	out := make([]domain.CryptoEntry, 0, len(doc.Result))
	seen := make(map[string]struct{}, len(doc.Result))
	for _, r := range doc.Result {
		addr := strings.TrimSpace(r.Address)
		if addr == "" {
			continue
		}
		chain := chainCodeFromLabel(r.Blockchain)
		key := chain + ":" + strings.ToLower(addr)
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, domain.CryptoEntry{
			Address: addr, Chain: chain,
			ListID: src.ID, Source: src.Name,
		})
	}
	return out, nil
}

func chainCodeFromLabel(label string) string {
	switch strings.ToLower(strings.TrimSpace(label)) {
	case "bitcoin":
		return "XBT"
	case "ethereum":
		return "ETH"
	case "monero":
		return "XMR"
	case "litecoin":
		return "LTC"
	case "dash":
		return "DASH"
	case "zcash":
		return "ZEC"
	case "":
		return "UNKNOWN"
	default:
		return strings.ToUpper(label)
	}
}
