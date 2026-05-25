package screening

import (
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func severityToInt(s domain.MonitorAlertSeverity) int {
	switch s {
	case domain.SeverityCritical:
		return 10
	case domain.SeverityHigh:
		return 8
	case domain.SeverityMedium:
		return 5
	default:
		return 2
	}
}

func mapPatternToAlert(pt domain.TxnPatternType) domain.TxnAlertType {
	switch pt {
	case domain.PatternStructuring, domain.PatternSmurfing:
		return domain.TxnStructuring
	case domain.PatternRapidMovement, domain.PatternLayering:
		return domain.TxnRapidMovement
	case domain.PatternHighRiskJuris:
		return domain.TxnHighRiskCountry
	default:
		return domain.TxnUnusualPattern
	}
}

func (a *TxnAnalyzer) evaluate(
	p domain.TxnPattern, txns []domain.Transaction, profile CustomerProfile,
) (domain.TxnAlert, bool) {
	switch p.Type {
	case domain.PatternStructuring:
		if domain.DetectStructuring(txns, p.Threshold, p.TimeWindow) {
			return a.buildAlert(txns[0], p, "Multiple sub-threshold transactions detected"), true
		}
	case domain.PatternRapidMovement:
		if domain.DetectRapidMovement(txns, p.TimeWindow) {
			return a.buildAlert(txns[0], p, "Rapid fund movement detected"), true
		}
	case domain.PatternHighRiskJuris:
		for _, txn := range txns {
			if domain.CountryRiskScore(txn.Country) >= 0.8 {
				return a.buildAlert(txn, p, fmt.Sprintf("High-risk jurisdiction: %s", txn.Country)), true
			}
		}
	case domain.PatternUnusualVolume:
		if a.detectUnusualVolume(txns, profile) {
			return a.buildAlert(txns[0], p, "Unusual transaction volume"), true
		}
	case domain.PatternDormantActivity:
		if a.detectDormant(txns, profile) {
			return a.buildAlert(txns[0], p, "Activity on dormant account"), true
		}
	}
	return domain.TxnAlert{}, false
}

func (a *TxnAnalyzer) detectUnusualVolume(txns []domain.Transaction, profile CustomerProfile) bool {
	if profile.AvgMonthlyTxns == 0 {
		return false
	}
	return len(txns) >= profile.AvgMonthlyTxns*3
}

func (a *TxnAnalyzer) detectDormant(txns []domain.Transaction, profile CustomerProfile) bool {
	if profile.LastActivityAt.IsZero() || len(txns) == 0 {
		return false
	}
	return txns[0].Timestamp.Sub(profile.LastActivityAt) >= 180*24*time.Hour
}

func (a *TxnAnalyzer) buildAlert(
	txn domain.Transaction, p domain.TxnPattern, desc string,
) domain.TxnAlert {
	severity := severityToInt(p.Severity)
	alert, _ := domain.NewTxnAlert(txn.TenantID, txn.ID, mapPatternToAlert(p.Type), severity, desc)
	return alert
}
