package ingestion

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// sdnCryptoRE matches "Digital Currency Address - <CHAIN> <addr>"
// fragments inside SDN.csv remarks columns. SDN concatenates many
// tags into a single quoted field; regex is the cheap correct path.
var sdnCryptoRE = regexp.MustCompile(
	`Digital Currency Address - ([A-Z]{3,5})\s+([A-Za-z0-9]{20,})`)

// FetchOFACSDNCrypto downloads sdn.csv and extracts every digital
// currency address tagged in the remarks column. Verified live
// 2026-04-29: ~165 occurrences across ETH/XBT/USDT/TRX/XMR/etc.
func FetchOFACSDNCrypto(src CryptoSource) ([]domain.CryptoEntry, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	req, _ := http.NewRequest("GET", src.URL, nil)
	req.Header.Set("User-Agent", "aegis-aml/1.0")
	resp, err := client.Do(req)
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
	return parseSDNCrypto(body, src), nil
}

func parseSDNCrypto(body []byte, src CryptoSource) []domain.CryptoEntry {
	matches := sdnCryptoRE.FindAllSubmatch(body, -1)
	seen := make(map[string]struct{}, len(matches))
	out := make([]domain.CryptoEntry, 0, len(matches))
	for _, m := range matches {
		chain := strings.ToUpper(string(m[1]))
		addr := strings.TrimSpace(string(m[2]))
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
	return out
}
