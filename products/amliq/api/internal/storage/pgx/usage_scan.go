package pgx

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanUsageRecord(row subscriptionScanner) (*domain.UsageRecord, error) {
	var rec domain.UsageRecord
	var product string
	var metricsJSON []byte

	err := row.Scan(
		&rec.ID, &rec.TenantID, &product,
		&rec.Period, &metricsJSON, &rec.LastUpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("usage record not found")
		}
		return nil, fmt.Errorf("scan usage: %w", err)
	}

	rec.Product = domain.Product(product)
	rec.Metrics = make(map[domain.UsageMetric]int64)

	if len(metricsJSON) > 0 {
		if err := json.Unmarshal(metricsJSON, &rec.Metrics); err != nil {
			return nil, fmt.Errorf("unmarshal metrics: %w", err)
		}
	}
	return &rec, nil
}

func collectUsageRecords(rows *sql.Rows) ([]domain.UsageRecord, error) {
	var recs []domain.UsageRecord
	for rows.Next() {
		rec, err := scanUsageRecord(rows)
		if err != nil {
			return nil, err
		}
		recs = append(recs, *rec)
	}
	return recs, rows.Err()
}
