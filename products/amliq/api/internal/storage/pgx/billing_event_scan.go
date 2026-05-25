package pgx

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanBillingEvent(row subscriptionScanner) (*domain.BillingEvent, error) {
	var evt domain.BillingEvent
	var eventType, tenantStr string
	var payloadBytes []byte

	err := row.Scan(&evt.ID, &eventType, &tenantStr, &payloadBytes, &evt.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("billing event not found")
		}
		return nil, fmt.Errorf("scan billing event: %w", err)
	}

	evt.Type = domain.BillingEventType(eventType)
	tenantID, _ := domain.NewTenantID(tenantStr)
	evt.TenantID = tenantID

	if len(payloadBytes) > 0 {
		evt.Payload = json.RawMessage(payloadBytes)
	}
	return &evt, nil
}

func collectBillingEvents(rows *sql.Rows) ([]domain.BillingEvent, error) {
	var evts []domain.BillingEvent
	for rows.Next() {
		evt, err := scanBillingEvent(rows)
		if err != nil {
			return nil, err
		}
		evts = append(evts, *evt)
	}
	return evts, rows.Err()
}
