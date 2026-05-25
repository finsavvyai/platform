package ingestion

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SyncAll fetches all crypto sources, diffs against DB, and upserts
// only changed entries. Uses content-hash fingerprints to skip
// unchanged sources. Reloads CryptoIndex after sync.
func (cs *CryptoSyncService) SyncAll(ctx context.Context) CryptoRefreshResult {
	start := time.Now()
	result := CryptoRefreshResult{BySource: make(map[string]int)}

	for _, src := range CryptoSources {
		if src.ID == "il-nbctf-crypto" {
			cs.syncNBCTF(ctx, &result)
			continue
		}
		cs.syncSource(ctx, src, &result)
	}

	// Reload index from DB after sync
	cs.reloadIndex(ctx)
	result.Duration = time.Since(start)
	log.Printf("crypto-sync: %d wallets, %d sources, %d errors in %v",
		result.TotalLoaded, len(result.BySource),
		len(result.Errors), result.Duration)
	return result
}

func fetchForSource(src CryptoSource) ([]domain.CryptoEntry, error) {
	switch src.ID {
	case "ofac-sdn-crypto":
		return FetchOFACSDNCrypto(src)
	case "ransomwhere":
		return FetchRansomwhere(src)
	case "chainalysis-sanctions":
		return FetchChainalysisSanctions(src)
	case "opensanctions-crypto":
		return FetchOpenSanctionsCrypto(src)
	case "eu-crypto":
		return FetchEUCrypto(src)
	case "uk-ofsi-crypto":
		return FetchUKOFSICrypto(src)
	case "bitcoinabuse":
		return FetchBitcoinAbuse(src)
	case "elliptic-sanctions":
		return FetchEllipticSanctions(src)
	default:
		return FetchCryptoAddresses(src)
	}
}

func (cs *CryptoSyncService) syncSource(
	ctx context.Context, src CryptoSource, result *CryptoRefreshResult,
) {
	entries, err := fetchForSource(src)
	if err != nil {
		log.Printf("crypto-sync %s: fetch failed: %v", src.ID, err)
		result.Errors = append(result.Errors, src.ID+": "+err.Error())
		return
	}

	hash := contentHash(entries)
	if cs.etags[src.ID] == hash {
		log.Printf("crypto-sync %s: unchanged (fingerprint match)", src.ID)
		result.BySource[src.ID] = len(entries)
		result.TotalLoaded += len(entries)
		return
	}

	if err := cs.store.UpsertCryptoEntries(ctx, entries); err != nil {
		log.Printf("crypto-sync %s: upsert failed: %v", src.ID, err)
		result.Errors = append(result.Errors, src.ID+": "+err.Error())
		return
	}

	cs.etags[src.ID] = hash
	result.BySource[src.ID] = len(entries)
	result.TotalLoaded += len(entries)
	log.Printf("crypto-sync %s: %d wallets synced", src.ID, len(entries))
}

func (cs *CryptoSyncService) syncNBCTF(
	ctx context.Context, result *CryptoRefreshResult,
) {
	entries, err := FetchNBCTFCrypto()
	if err != nil {
		log.Printf("crypto-sync nbctf: %v", err)
		result.Errors = append(result.Errors, "il-nbctf-crypto: "+err.Error())
		return
	}

	hash := contentHash(entries)
	if cs.etags["il-nbctf-crypto"] == hash {
		log.Printf("crypto-sync nbctf: unchanged")
		result.BySource["il-nbctf-crypto"] = len(entries)
		result.TotalLoaded += len(entries)
		return
	}

	if err := cs.store.UpsertCryptoEntries(ctx, entries); err != nil {
		result.Errors = append(result.Errors, "nbctf-upsert: "+err.Error())
		return
	}

	cs.etags["il-nbctf-crypto"] = hash
	result.BySource["il-nbctf-crypto"] = len(entries)
	result.TotalLoaded += len(entries)
}

func (cs *CryptoSyncService) reloadIndex(ctx context.Context) {
	entries, err := cs.store.ListCryptoEntries(ctx)
	if err != nil {
		log.Printf("crypto-sync: reload index failed: %v", err)
		return
	}
	cs.index.Load(entries)
	log.Printf("crypto-sync: index reloaded with %d wallets",
		cs.index.Count())
}

// contentHash produces a SHA-256 fingerprint of sorted addresses.
func contentHash(entries []domain.CryptoEntry) string {
	addrs := make([]string, len(entries))
	for i, e := range entries {
		addrs[i] = fmt.Sprintf("%s:%s", e.Chain,
			strings.ToLower(e.Address))
	}
	sort.Strings(addrs)
	h := sha256.Sum256([]byte(strings.Join(addrs, "\n")))
	return fmt.Sprintf("%x", h[:16])
}
