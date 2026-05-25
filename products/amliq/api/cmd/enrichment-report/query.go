package main

import (
	"database/sql"
	"fmt"
)

// coverageRow is one per-list row with counts + percentages for every
// enrichment field.
type coverageRow struct {
	ListID        string `json:"list_id"`
	Total         int    `json:"total"`
	DOB           int    `json:"dob"`
	Nat           int    `json:"nationalities"`
	Addr          int    `json:"addresses"`
	IDs           int    `json:"identifiers"`
	Aliases       int    `json:"aliases"`
	PEPTier       int    `json:"pep_tier"`
	PositionTitle int    `json:"position_title"`
	PlaceOfBirth  int    `json:"place_of_birth"`
	Gender        int    `json:"gender"`
	Designation   int    `json:"designation_date"`
}

// queryCoverage runs one grouped query over entities and returns one
// row per list_id with counts for every enrichment field. Filters
// deleted rows, optionally scopes to a tenant, and drops lists with
// fewer than minRows entities (default 1 = show everything that has
// any data).
func queryCoverage(db *sql.DB, tenantID string, minRows int) ([]coverageRow, error) {
	where := "deleted_at IS NULL"
	args := []interface{}{}
	if tenantID != "" {
		where += " AND tenant_id = $1"
		args = append(args, tenantID)
	}
	q := fmt.Sprintf(`
		SELECT
			list_id,
			COUNT(*)                                                             AS total,
			COUNT(dob)                                                           AS dob,
			COUNT(*) FILTER (WHERE nationalities IS NOT NULL AND nationalities<>'') AS nat,
			COUNT(*) FILTER (WHERE addresses IS NOT NULL AND jsonb_array_length(addresses) > 0) AS addr,
			COUNT(*) FILTER (WHERE identifiers IS NOT NULL AND jsonb_array_length(identifiers) > 0) AS ids,
			COUNT(*) FILTER (WHERE aliases IS NOT NULL AND jsonb_array_length(aliases) > 0) AS aliases,
			COUNT(*) FILTER (WHERE pep_tier IS NOT NULL AND pep_tier > 0)        AS pep_tier,
			COUNT(position_title)                                                AS position_title,
			COUNT(place_of_birth)                                                AS place_of_birth,
			COUNT(gender)                                                        AS gender,
			COUNT(designation_date)                                              AS designation_date
		FROM entities
		WHERE %s
		GROUP BY list_id
		HAVING COUNT(*) >= %d
		ORDER BY COUNT(*) DESC`, where, minRows)

	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	var out []coverageRow
	for rows.Next() {
		var r coverageRow
		if err := rows.Scan(&r.ListID, &r.Total, &r.DOB, &r.Nat,
			&r.Addr, &r.IDs, &r.Aliases, &r.PEPTier,
			&r.PositionTitle, &r.PlaceOfBirth, &r.Gender,
			&r.Designation); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
