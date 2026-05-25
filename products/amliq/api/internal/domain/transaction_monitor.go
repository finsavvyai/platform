package domain

import (
	"fmt"
	"time"
)

// TxnAlertType classifies transaction monitoring alerts.
type TxnAlertType string

const (
	TxnHighValue       TxnAlertType = "high_value"
	TxnRapidMovement   TxnAlertType = "rapid_movement"
	TxnStructuring     TxnAlertType = "structuring"
	TxnHighRiskCountry TxnAlertType = "high_risk_country"
	TxnUnusualPattern  TxnAlertType = "unusual_pattern"
)

// Transaction represents a financial transaction to monitor.
type Transaction struct {
	ID             string
	TenantID       TenantID
	EntityID       string
	CounterpartyID string
	AmountCents    int64
	Currency       string
	Direction      string // inbound, outbound
	Country        string
	Reference      string
	Timestamp      time.Time
}

// TxnAlert is raised when a transaction triggers a rule.
type TxnAlert struct {
	ID            string
	TenantID      TenantID
	TransactionID string
	AlertType     TxnAlertType
	Severity      int
	Description   string
	CreatedAt     time.Time
}

func NewTxnAlert(
	tenantID TenantID, txnID string,
	alertType TxnAlertType, severity int, desc string,
) (TxnAlert, error) {
	if tenantID.IsZero() || txnID == "" {
		return TxnAlert{}, fmt.Errorf("tenant and txn required")
	}
	return TxnAlert{
		ID:            fmt.Sprintf("txalert_%d", time.Now().UnixNano()),
		TenantID:      tenantID,
		TransactionID: txnID,
		AlertType:     alertType,
		Severity:      severity,
		Description:   desc,
		CreatedAt:     time.Now().UTC(),
	}, nil
}
