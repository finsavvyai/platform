package screening

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// BuildBloomFromDB streams all entity names from the database
// and builds a bloom filter without loading everything into RAM.
func BuildBloomFromDB(db *sql.DB) (*BloomFilter, error) {
	start := time.Now()

	count, err := countEntities(db)
	if err != nil {
		return nil, fmt.Errorf("bloom count: %w", err)
	}
	if count == 0 {
		count = 1000 // default sizing
	}

	bf := NewBloom(count, 0.001)
	added, err := streamNamesIntoBF(db, bf)
	if err != nil {
		return nil, fmt.Errorf("bloom stream: %w", err)
	}

	elapsed := time.Since(start).Milliseconds()
	log.Printf(
		"Built bloom filter: %d names, %d MB, %d ms",
		added, bf.MemoryBytes()/(1024*1024), elapsed,
	)
	return bf, nil
}

func countEntities(db *sql.DB) (int, error) {
	var n int
	err := db.QueryRow("SELECT COUNT(*) FROM entities").Scan(&n)
	return n, err
}

func streamNamesIntoBF(db *sql.DB, bf *BloomFilter) (int, error) {
	rows, err := db.Query("SELECT full_name FROM entities")
	if err != nil {
		return 0, fmt.Errorf("query names: %w", err)
	}
	defer rows.Close()

	added := 0
	var name string
	for rows.Next() {
		if err := rows.Scan(&name); err != nil {
			return added, fmt.Errorf("scan name: %w", err)
		}
		bf.Add(name)
		added++
	}
	return added, rows.Err()
}
