package pgx

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanAlertFromRows(rows *sql.Rows) (*domain.Alert, error) {
	var (
		id, tenantID, screeningID, status, priority string
		assignedTo, resolution, justification       string
		matchJSON                                   []byte
		createdAt, updatedAt                        time.Time
		resolvedAt                                  *time.Time
	)

	err := rows.Scan(&id, &tenantID, &screeningID, &status, &priority,
		&assignedTo, &resolution, &justification, &matchJSON, &createdAt,
		&updatedAt, &resolvedAt)
	if err != nil {
		return nil, fmt.Errorf("scan alert: %w", err)
	}

	tid, err := domain.NewTenantID(tenantID)
	if err != nil {
		return nil, err
	}

	statusVal, _ := domain.ParseAlertStatus(status)
	priorityVal, _ := domain.ParseAlertPriority(priority)

	var matchResult domain.MatchResult
	if len(matchJSON) > 0 {
		json.Unmarshal(matchJSON, &matchResult)
	}

	alert := domain.Alert{
		ID:            id,
		TenantID:      tid,
		ScreeningID:   screeningID,
		Status:        statusVal,
		Priority:      priorityVal,
		AssignedTo:    assignedTo,
		Resolution:    resolution,
		Justification: justification,
		MatchResult:   matchResult,
		CreatedAt:     createdAt,
		UpdatedAt:     updatedAt,
		ResolvedAt:    resolvedAt,
	}
	return &alert, nil
}
