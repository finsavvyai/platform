package pgx

import (
	"database/sql"
	"strconv"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanCases(rows *sql.Rows) ([]domain.ComplianceCase, error) {
	var cases []domain.ComplianceCase
	for rows.Next() {
		var c domain.ComplianceCase
		var tid string
		if err := rows.Scan(
			&c.ID, &tid, &c.ScreeningID, &c.EntityName,
			&c.MatchedName, &c.ListID, &c.Confidence,
			&c.Status, &c.Priority, &c.AssignedTo,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		c.TenantID, _ = domain.NewTenantID(tid)
		cases = append(cases, c)
	}
	return cases, rows.Err()
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
