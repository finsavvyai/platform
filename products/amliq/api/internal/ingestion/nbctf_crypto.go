package ingestion

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

var (
	btcAddrRe = regexp.MustCompile(`\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b`)
	ethAddrRe = regexp.MustCompile(`\b0x[0-9a-fA-F]{40}\b`)
	trxAddrRe = regexp.MustCompile(`\bT[1-9A-HJ-NP-Za-km-z]{33}\b`)
)

// ParseNBCTFCrypto extracts crypto addresses from NBCTF HTML page.
func ParseNBCTFCrypto(html []byte) []domain.CryptoEntry {
	text := string(html)
	var entries []domain.CryptoEntry

	for _, addr := range btcAddrRe.FindAllString(text, -1) {
		entries = append(entries, domain.CryptoEntry{
			Address: addr, Chain: "BTC",
			ListID: "il-nbctf-crypto", Source: "Israel NBCTF",
		})
	}
	for _, addr := range ethAddrRe.FindAllString(text, -1) {
		entries = append(entries, domain.CryptoEntry{
			Address: strings.ToLower(addr), Chain: "ETH",
			ListID: "il-nbctf-crypto", Source: "Israel NBCTF",
		})
	}
	for _, addr := range trxAddrRe.FindAllString(text, -1) {
		entries = append(entries, domain.CryptoEntry{
			Address: addr, Chain: "TRX",
			ListID: "il-nbctf-crypto", Source: "Israel NBCTF",
		})
	}
	return dedup(entries)
}

func dedup(entries []domain.CryptoEntry) []domain.CryptoEntry {
	seen := map[string]bool{}
	var out []domain.CryptoEntry
	for _, e := range entries {
		key := fmt.Sprintf("%s:%s", e.Chain, e.Address)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, e)
	}
	return out
}
