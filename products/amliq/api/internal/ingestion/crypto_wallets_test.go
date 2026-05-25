package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestCryptoSourcesComplete(t *testing.T) {
	if len(CryptoSources) < 10 {
		t.Errorf("expected ≥10 crypto sources, got %d", len(CryptoSources))
	}
	seen := map[string]bool{}
	for _, s := range CryptoSources {
		if s.ID == "" || s.Name == "" || s.Chain == "" || s.URL == "" {
			t.Errorf("incomplete source: %+v", s)
		}
		if seen[s.ID] {
			t.Errorf("duplicate source ID: %s", s.ID)
		}
		seen[s.ID] = true
	}
}

func TestCryptoChainsCovered(t *testing.T) {
	chains := map[string]bool{}
	for _, s := range CryptoSources {
		chains[s.Chain] = true
	}
	// Live-verified upstream OFAC list branch on 2026-04-29.
	// SOL/BNB/MATIC/OP/ZEC removed: those files do not exist
	// in 0xB10C/ofac-sanctioned-digital-currency-addresses.
	required := []string{"XBT", "ETH", "XMR", "LTC", "TRX", "USDT", "USDC"}
	for _, c := range required {
		if !chains[c] {
			t.Errorf("missing chain: %s", c)
		}
	}
}

func TestOFACSourcesNotEmpty(t *testing.T) {
	sources := OFACSources()
	if len(sources) < 10 {
		t.Errorf("expected ≥10 OFAC sources, got %d", len(sources))
	}
	for _, s := range sources {
		if s.URL == "" {
			t.Errorf("source %s has empty URL", s.ID)
		}
	}
}

func TestContentHashDeterministic(t *testing.T) {
	entries := []domain.CryptoEntry{
		{Address: "0xAAA", Chain: "ETH"},
		{Address: "0xBBB", Chain: "BTC"},
	}
	h1 := contentHash(entries)
	h2 := contentHash(entries)
	if h1 != h2 {
		t.Errorf("non-deterministic hash: %s != %s", h1, h2)
	}
}
