package screening

import (
	"strings"
	"sync"

	"github.com/aegis-aml/aegis/internal/domain"
)

// CryptoIndex is an in-memory hash map of sanctioned wallet addresses.
// O(1) lookup — sub-microsecond per address check.
type CryptoIndex struct {
	mu      sync.RWMutex
	wallets map[string]domain.CryptoEntry // address → entry
	count   int
}

// NewCryptoIndex creates an empty crypto wallet index.
func NewCryptoIndex() *CryptoIndex {
	return &CryptoIndex{
		wallets: make(map[string]domain.CryptoEntry),
	}
}

// Load populates the index from a list of entries.
func (ci *CryptoIndex) Load(entries []domain.CryptoEntry) {
	ci.mu.Lock()
	defer ci.mu.Unlock()
	ci.wallets = make(map[string]domain.CryptoEntry, len(entries))
	for _, e := range entries {
		ci.wallets[normalizeAddress(e.Address)] = e
	}
	ci.count = len(ci.wallets)
}

// Lookup checks if a wallet address is sanctioned. O(1).
func (ci *CryptoIndex) Lookup(address string) (domain.CryptoEntry, bool) {
	ci.mu.RLock()
	defer ci.mu.RUnlock()
	entry, found := ci.wallets[normalizeAddress(address)]
	return entry, found
}

// Append adds entries without clearing existing ones.
func (ci *CryptoIndex) Append(entries []domain.CryptoEntry) {
	ci.mu.Lock()
	defer ci.mu.Unlock()
	for _, e := range entries {
		ci.wallets[normalizeAddress(e.Address)] = e
	}
	ci.count = len(ci.wallets)
}

// Count returns the number of indexed wallets.
func (ci *CryptoIndex) Count() int {
	ci.mu.RLock()
	defer ci.mu.RUnlock()
	return ci.count
}

// normalizeAddress lowercases and trims a wallet address.
func normalizeAddress(addr string) string {
	return strings.ToLower(strings.TrimSpace(addr))
}
