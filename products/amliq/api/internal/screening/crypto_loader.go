package screening

import (
	"database/sql"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// LoadCryptoFromDB builds the crypto index from the crypto_wallets
// table (synced by CryptoSyncService). Falls back to entities table
// for backwards compatibility.
func LoadCryptoFromDB(db *sql.DB) *CryptoIndex {
	idx := NewCryptoIndex()
	LoadCryptoInto(db, idx)
	return idx
}

// LoadCryptoInto hydrates an existing CryptoIndex in place. Use this
// when consumers hold a stable pointer to the index (e.g. sync services).
func LoadCryptoInto(db *sql.DB, idx *CryptoIndex) {
	start := time.Now()
	entries := loadFromCryptoTable(db)
	if len(entries) == 0 {
		entries = loadFromEntitiesTable(db)
	}
	idx.Load(entries)
	log.Printf("crypto index: %d wallets loaded in %v",
		idx.Count(), time.Since(start))
}

func loadFromCryptoTable(db *sql.DB) []domain.CryptoEntry {
	rows, err := db.Query(`
		SELECT address, chain, COALESCE(entity_id,''),
		       list_id, source
		FROM crypto_wallets`)
	if err != nil {
		log.Printf("crypto_wallets table: %v (may not exist)", err)
		return nil
	}
	defer rows.Close()
	return scanCryptoRows(rows)
}

func loadFromEntitiesTable(db *sql.DB) []domain.CryptoEntry {
	rows, err := db.Query(`
		SELECT id, full_name, list_id FROM entities
		WHERE type = 'CryptoWallet'
		   OR full_name LIKE '0x%'
		   OR full_name LIKE 'bc1%'`)
	if err != nil {
		log.Printf("crypto from entities: %v", err)
		return nil
	}
	defer rows.Close()

	var entries []domain.CryptoEntry
	for rows.Next() {
		var id, name, listID string
		if err := rows.Scan(&id, &name, &listID); err != nil {
			continue
		}
		entries = append(entries, domain.CryptoEntry{
			Address: name, Chain: detectChain(name),
			EntityID: id, ListID: listID, Source: listID,
		})
	}
	return entries
}

func scanCryptoRows(rows *sql.Rows) []domain.CryptoEntry {
	var entries []domain.CryptoEntry
	for rows.Next() {
		var e domain.CryptoEntry
		if err := rows.Scan(
			&e.Address, &e.Chain, &e.EntityID,
			&e.ListID, &e.Source,
		); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return entries
}
