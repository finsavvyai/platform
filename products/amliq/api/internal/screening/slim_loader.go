package screening

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

const slimLoadBatch = 10000

// LoadSlimIndex streams all entities from DB and builds a compact index.
func LoadSlimIndex(db *sql.DB) (*SlimIndex, error) {
	start := time.Now()

	count, err := countEntities(db)
	if err != nil {
		return nil, fmt.Errorf("slim count: %w", err)
	}

	si := NewSlimIndex()
	loaded, err := streamIntoSlim(db, si)
	if err != nil {
		return nil, fmt.Errorf("slim load: %w", err)
	}

	elapsed := time.Since(start).Milliseconds()
	log.Printf(
		"SlimIndex loaded: %d entities, %d phonetic keys, %d ms (expected %d)",
		loaded, len(si.phonetic), elapsed, count,
	)
	return si, nil
}

func streamIntoSlim(db *sql.DB, si *SlimIndex) (int, error) {
	rows, err := db.Query(
		"SELECT id, full_name FROM entities ORDER BY id",
	)
	if err != nil {
		return 0, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	loaded := 0
	var id, fullName string
	for rows.Next() {
		if err := rows.Scan(&id, &fullName); err != nil {
			return loaded, fmt.Errorf("scan: %w", err)
		}
		si.Add(id, fullName)
		loaded++
	}
	return loaded, rows.Err()
}
