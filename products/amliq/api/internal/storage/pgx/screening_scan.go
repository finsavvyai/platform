package pgx

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanScreening(row *sql.Row) (*domain.ScreenResponse, error) {
	var (
		id, tenantID, entityID, disposition string
		maxConfidence                       float64
		processingTimeMs                    int64
		resultJSON                          []byte
		createdAt                           interface{}
	)

	err := row.Scan(&id, &tenantID, &entityID, &maxConfidence,
		&disposition, &processingTimeMs, &resultJSON, &createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("scan screening: %w", err)
	}

	return buildScreening(id, tenantID, entityID, disposition,
		maxConfidence, processingTimeMs, resultJSON)
}

func scanScreeningFromRows(rows *sql.Rows) (*domain.ScreenResponse, error) {
	var (
		id, tenantID, entityID, disposition string
		maxConfidence                       float64
		processingTimeMs                    int64
		resultJSON                          []byte
		createdAt                           interface{}
	)

	err := rows.Scan(&id, &tenantID, &entityID, &maxConfidence,
		&disposition, &processingTimeMs, &resultJSON, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("scan screening: %w", err)
	}

	return buildScreening(id, tenantID, entityID, disposition,
		maxConfidence, processingTimeMs, resultJSON)
}

func buildScreening(id, tenantID, entityID, disposition string,
	maxConfidence float64, processingTimeMs int64,
	resultJSON []byte) (*domain.ScreenResponse, error) {

	var resp domain.ScreenResponse
	if err := json.Unmarshal(resultJSON, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}
	return &resp, nil
}
