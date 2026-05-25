package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestCryptoIndex(t *testing.T) {
	tests := []struct {
		name    string
		entries []domain.CryptoEntry
		lookup  string
		found   bool
		chain   string
	}{
		{
			name: "exact BTC match",
			entries: []domain.CryptoEntry{
				{Address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", Chain: "BTC", ListID: "ofac-btc"},
			},
			lookup: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			found:  true, chain: "BTC",
		},
		{
			name: "case insensitive ETH",
			entries: []domain.CryptoEntry{
				{Address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", Chain: "ETH", ListID: "ofac-eth"},
			},
			lookup: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
			found:  true, chain: "ETH",
		},
		{
			name:    "not found returns false",
			entries: []domain.CryptoEntry{},
			lookup:  "0xDEADBEEF",
			found:   false,
		},
		{
			name: "TRX address match",
			entries: []domain.CryptoEntry{
				{Address: "TN2YqTv5DjTcFRXqEBEyWnFMs5LkQnLfZi", Chain: "TRX", ListID: "ofac-usdt"},
			},
			lookup: "TN2YqTv5DjTcFRXqEBEyWnFMs5LkQnLfZi",
			found:  true, chain: "TRX",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			idx := NewCryptoIndex()
			idx.Load(tc.entries)
			entry, found := idx.Lookup(tc.lookup)
			if found != tc.found {
				t.Errorf("found=%v, want %v", found, tc.found)
			}
			if found && entry.Chain != tc.chain {
				t.Errorf("chain=%s, want %s", entry.Chain, tc.chain)
			}
		})
	}
}

func TestCryptoIndexAppend(t *testing.T) {
	idx := NewCryptoIndex()
	idx.Load([]domain.CryptoEntry{
		{Address: "0xAAA", Chain: "ETH"},
	})
	if idx.Count() != 1 {
		t.Fatalf("count=%d, want 1", idx.Count())
	}

	idx.Append([]domain.CryptoEntry{
		{Address: "0xBBB", Chain: "ETH"},
		{Address: "0xCCC", Chain: "ETH"},
	})
	if idx.Count() != 3 {
		t.Fatalf("after append count=%d, want 3", idx.Count())
	}

	_, found := idx.Lookup("0xaaa")
	if !found {
		t.Error("original entry should still be present")
	}
	_, found = idx.Lookup("0xbbb")
	if !found {
		t.Error("appended entry should be present")
	}
}
