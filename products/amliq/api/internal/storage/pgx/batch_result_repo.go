package pgx

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

type BatchResultRepository struct {
	db *sql.DB
}

func NewBatchResultRepository(db *sql.DB) *BatchResultRepository {
	return &BatchResultRepository{db: db}
}

func (r *BatchResultRepository) BulkInsert(ctx context.Context, results []domain.BatchResult) error {
	if len(results) == 0 {
		return nil
	}
	var b strings.Builder
	b.WriteString(`INSERT INTO batch_results (batch_id, entity_name, match_count, top_match, confidence, list_id) VALUES `)
	args := make([]interface{}, 0, len(results)*6)
	for i, res := range results {
		if i > 0 {
			b.WriteString(",")
		}
		off := i * 6
		fmt.Fprintf(&b, "($%d,$%d,$%d,$%d,$%d,$%d)",
			off+1, off+2, off+3, off+4, off+5, off+6)
		args = append(args, res.BatchID, res.EntityName,
			res.MatchCount, res.TopMatch, res.Confidence, res.ListID)
	}
	_, err := r.db.ExecContext(ctx, b.String(), args...)
	return err
}

func (r *BatchResultRepository) ListByBatchID(
	ctx context.Context, batchID string,
) ([]domain.BatchResult, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT batch_id, entity_name, match_count, top_match, confidence, list_id
		FROM batch_results WHERE batch_id=$1
		ORDER BY confidence DESC`, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBatchResults(rows)
}

func scanBatchResults(rows *sql.Rows) ([]domain.BatchResult, error) {
	var results []domain.BatchResult
	for rows.Next() {
		var br domain.BatchResult
		if err := rows.Scan(&br.BatchID, &br.EntityName,
			&br.MatchCount, &br.TopMatch, &br.Confidence, &br.ListID,
		); err != nil {
			return nil, err
		}
		results = append(results, br)
	}
	return results, rows.Err()
}
