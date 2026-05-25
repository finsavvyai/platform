package ingestion

import (
	"context"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

// CryptoRefreshResult holds the outcome of a crypto refresh cycle.
type CryptoRefreshResult struct {
	TotalLoaded int            `json:"total_loaded"`
	BySource    map[string]int `json:"by_source"`
	Errors      []string       `json:"errors,omitempty"`
	Duration    time.Duration  `json:"duration"`
}

// CryptoSyncService handles scheduled sync of crypto wallet addresses
// into the database, with fingerprint-based change detection.
type CryptoSyncService struct {
	store CryptoStore
	index *screening.CryptoIndex
	etags map[string]string // sourceID → content hash
}

// CryptoStore persists sanctioned wallet addresses.
type CryptoStore interface {
	UpsertCryptoEntries(ctx context.Context, entries []domain.CryptoEntry) error
	DeleteCryptoBySource(ctx context.Context, sourceID string) error
	ListCryptoEntries(ctx context.Context) ([]domain.CryptoEntry, error)
}

// NewCryptoSyncService creates a sync service for crypto wallets.
func NewCryptoSyncService(
	store CryptoStore, index *screening.CryptoIndex,
) *CryptoSyncService {
	return &CryptoSyncService{
		store: store,
		index: index,
		etags: make(map[string]string),
	}
}
