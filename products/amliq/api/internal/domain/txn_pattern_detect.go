package domain

import "time"

// DetectStructuring checks for multiple sub-threshold transactions.
func DetectStructuring(txns []Transaction, threshold int64, window time.Duration) bool {
	if len(txns) < 3 {
		return false
	}
	now := txns[len(txns)-1].Timestamp
	count := 0
	for _, txn := range txns {
		inWindow := now.Sub(txn.Timestamp) <= window
		nearThreshold := txn.AmountCents >= threshold-100000 && txn.AmountCents < 1000000
		if inWindow && nearThreshold {
			count++
		}
	}
	return count >= 3
}

// DetectRapidMovement checks for funds in and out quickly.
func DetectRapidMovement(txns []Transaction, window time.Duration) bool {
	for i, a := range txns {
		if a.Direction != "inbound" {
			continue
		}
		for _, b := range txns[i+1:] {
			if b.Direction == "outbound" && b.Timestamp.Sub(a.Timestamp) <= window {
				return true
			}
		}
	}
	return false
}

// ClassifySeverity maps an integer score to a severity level.
func ClassifySeverity(score int) MonitorAlertSeverity {
	switch {
	case score >= 9:
		return SeverityCritical
	case score >= 7:
		return SeverityHigh
	case score >= 4:
		return SeverityMedium
	default:
		return SeverityLow
	}
}
