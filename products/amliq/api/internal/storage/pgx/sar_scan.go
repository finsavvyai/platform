package pgx

import (
	"database/sql"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanSAR(row subscriptionScanner) (*domain.SAR, error) {
	var s domain.SAR
	var tid, actType, status, regBody string

	err := row.Scan(
		&s.ID, &tid, &s.CaseID, &s.SubjectName, &s.SubjectType,
		&actType, &s.NarrativeSummary, &s.TotalAmount, &status,
		&regBody, &s.DateRangeFrom, &s.DateRangeTo, &s.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("sar not found")
		}
		return nil, fmt.Errorf("scan sar: %w", err)
	}
	s.TenantID, _ = domain.NewTenantID(tid)
	s.ActivityType = domain.SARActivityType(actType)
	s.FilingStatus = domain.SARFilingStatus(status)
	s.RegulatoryBody = domain.RegulatoryBody(regBody)
	return &s, nil
}

func collectSARs(rows *sql.Rows) ([]domain.SAR, error) {
	var sars []domain.SAR
	for rows.Next() {
		s, err := scanSAR(rows)
		if err != nil {
			return nil, err
		}
		sars = append(sars, *s)
	}
	return sars, rows.Err()
}
