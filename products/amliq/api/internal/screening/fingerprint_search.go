package screening

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// FingerprintSearcher queries the search_fingerprints table.
type FingerprintSearcher struct {
	db *sql.DB
}

// NewFingerprintSearcher creates a new fingerprint-based searcher.
func NewFingerprintSearcher(db *sql.DB) *FingerprintSearcher {
	return &FingerprintSearcher{db: db}
}

// Search finds entity IDs matching fingerprints of the given name.
func (fs *FingerprintSearcher) Search(
	ctx context.Context, name string, limit int,
) ([]string, error) {
	if name == "" {
		return nil, fmt.Errorf("name required")
	}
	if limit <= 0 {
		limit = 50
	}

	fps := GenerateQueryFingerprints(name)
	if len(fps) == 0 {
		return nil, nil
	}

	return fs.queryByFingerprints(ctx, fps, limit)
}

func (fs *FingerprintSearcher) queryByFingerprints(
	ctx context.Context, fps []Fingerprint, limit int,
) ([]string, error) {
	// Build (fp_type, fp_value) value list for IN clause
	args := make([]interface{}, 0, len(fps)*2+1)
	var conditions []string

	for i, fp := range fps {
		base := i * 2
		conditions = append(conditions,
			fmt.Sprintf("(fp_type = $%d AND fp_value = $%d)", base+1, base+2),
		)
		args = append(args, fp.Type, fp.Value)
	}

	limitIdx := len(args) + 1
	args = append(args, limit)

	query := fmt.Sprintf(
		`SELECT entity_id, COUNT(*) AS hits
		 FROM search_fingerprints
		 WHERE %s
		 GROUP BY entity_id
		 ORDER BY hits DESC
		 LIMIT $%d`,
		strings.Join(conditions, " OR "), limitIdx,
	)

	rows, err := fs.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("fingerprint query: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		var hits int
		if err := rows.Scan(&id, &hits); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
