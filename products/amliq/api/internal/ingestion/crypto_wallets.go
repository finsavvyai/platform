package ingestion

import (
	"bufio"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)


// OFACSources returns OFAC sanctioned crypto address lists.
// URLs verified live 2026-04-29 against 0xB10C/ofac-sanctioned-
// digital-currency-addresses lists branch. Each file is plain text,
// one address per line. Chains absent from upstream (SOL, MATIC, OP,
// BNB, ZEC) intentionally dropped — they 404'd in prior config.
func OFACSources() []CryptoSource {
	base := "https://raw.githubusercontent.com/" +
		"0xB10C/ofac-sanctioned-digital-currency-addresses/lists/" +
		"sanctioned_addresses_"
	chains := []struct{ chain, name string }{
		{"XBT", "Bitcoin"}, {"ETH", "Ethereum"}, {"XMR", "Monero"},
		{"USDT", "Tether"}, {"USDC", "USD Coin"}, {"TRX", "Tron"},
		{"LTC", "Litecoin"}, {"DASH", "Dash"}, {"ARB", "Arbitrum"},
		{"BCH", "Bitcoin Cash"}, {"BSC", "BNB Smart Chain"},
		{"BSV", "Bitcoin SV"}, {"BTG", "Bitcoin Gold"},
		{"ETC", "Ethereum Classic"}, {"XRP", "Ripple"},
	}
	out := make([]CryptoSource, 0, len(chains))
	for _, c := range chains {
		out = append(out, CryptoSource{
			ID:    "ofac-" + strings.ToLower(c.chain),
			Name:  "OFAC " + c.name, Chain: c.chain,
			URL: base + c.chain + ".txt",
		})
	}
	return out
}

// CryptoSources is the full set of crypto address sources.
var CryptoSources = buildCryptoSources()

func buildCryptoSources() []CryptoSource {
	sources := OFACSources()
	sources = append(sources, ExtendedCryptoSources()...)
	sources = append(sources, nbctfSource()...)
	return sources
}

func nbctfSource() []CryptoSource {
	return []CryptoSource{
		{ID: "il-nbctf-crypto", Name: "Israel NBCTF Crypto",
			Chain: "MULTI", URL: nbctfBlockchainURL},
	}
}

// CryptoSource defines a blockchain address list source.
type CryptoSource struct {
	ID    string
	Name  string
	Chain string
	URL   string
}

// FetchCryptoAddresses downloads wallet addresses from a text source.
func FetchCryptoAddresses(src CryptoSource) ([]domain.CryptoEntry, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(src.URL)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", src.ID, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("fetch %s: HTTP %d", src.ID, resp.StatusCode)
	}
	var entries []domain.CryptoEntry
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		addr := strings.TrimSpace(scanner.Text())
		if addr == "" || strings.HasPrefix(addr, "#") {
			continue
		}
		entries = append(entries, domain.CryptoEntry{
			Address:  addr,
			Chain:    src.Chain,
			EntityID: "",
			ListID:   src.ID,
			Source:   src.Name,
		})
	}
	return entries, scanner.Err()
}
