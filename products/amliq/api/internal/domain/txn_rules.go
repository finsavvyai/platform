package domain

// TxnRule defines a transaction monitoring rule.
type TxnRule struct {
	ID             string
	TenantID       TenantID
	Name           string
	AlertType      TxnAlertType
	ThresholdCents int64
	WindowHours    int
	Enabled        bool
}

// DefaultTxnRules returns standard transaction monitoring rules.
func DefaultTxnRules(tenantID TenantID) []TxnRule {
	return []TxnRule{
		{
			Name: "High Value Transaction", AlertType: TxnHighValue,
			TenantID: tenantID, ThresholdCents: 1000000, // $10,000
			WindowHours: 0, Enabled: true,
		},
		{
			Name: "Rapid Fund Movement", AlertType: TxnRapidMovement,
			TenantID: tenantID, ThresholdCents: 500000,
			WindowHours: 24, Enabled: true,
		},
		{
			Name: "Structuring Detection", AlertType: TxnStructuring,
			TenantID: tenantID, ThresholdCents: 900000, // Just under $10K
			WindowHours: 48, Enabled: true,
		},
		{
			Name: "High Risk Country", AlertType: TxnHighRiskCountry,
			TenantID: tenantID, ThresholdCents: 0,
			WindowHours: 0, Enabled: true,
		},
	}
}

// EvaluateHighValue checks if a transaction exceeds the threshold.
func EvaluateHighValue(txn Transaction, rule TxnRule) bool {
	return txn.AmountCents >= rule.ThresholdCents
}

// EvaluateHighRiskCountry checks if transaction involves a risky jurisdiction.
func EvaluateHighRiskCountry(txn Transaction) bool {
	return CountryRiskScore(txn.Country) >= 0.8
}
