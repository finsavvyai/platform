package domain

import (
	"fmt"
	"time"
)

// TxnPatternType classifies suspicious transaction patterns.
type TxnPatternType string

const (
	PatternStructuring     TxnPatternType = "structuring"
	PatternRapidMovement   TxnPatternType = "rapid_movement"
	PatternRoundTripping   TxnPatternType = "round_tripping"
	PatternLayering        TxnPatternType = "layering"
	PatternSmurfing        TxnPatternType = "smurfing"
	PatternUnusualVolume   TxnPatternType = "unusual_volume"
	PatternHighRiskJuris   TxnPatternType = "high_risk_jurisdiction"
	PatternDormantActivity TxnPatternType = "dormant_activity"
)


// TxnPattern defines a suspicious transaction detection rule.
type TxnPattern struct {
	ID          string
	Name        string
	Description string
	Type        TxnPatternType
	Threshold   int64
	TimeWindow  time.Duration
	Severity    MonitorAlertSeverity
}

// DefaultPatterns returns built-in detection patterns.
func DefaultPatterns() []TxnPattern {
	return []TxnPattern{
		{
			ID: "pat_structuring", Name: "Structuring",
			Description: "Multiple transactions just below $10K reporting threshold",
			Type: PatternStructuring, Threshold: 950000,
			TimeWindow: 48 * time.Hour, Severity: SeverityHigh,
		},
		{
			ID: "pat_rapid", Name: "Rapid Movement",
			Description: "Funds in and out within 24 hours",
			Type: PatternRapidMovement, Threshold: 500000,
			TimeWindow: 24 * time.Hour, Severity: SeverityHigh,
		},
		{
			ID: "pat_round_trip", Name: "Round-Tripping",
			Description: "Funds return to originator through intermediaries",
			Type: PatternRoundTripping, Threshold: 100000,
			TimeWindow: 72 * time.Hour, Severity: SeverityCritical,
		},
		{
			ID: "pat_volume", Name: "Unusual Volume",
			Description: "Transaction count/amount 3x above customer normal",
			Type: PatternUnusualVolume, Threshold: 3,
			TimeWindow: 30 * 24 * time.Hour, Severity: SeverityMedium,
		},
		{
			ID: "pat_high_risk", Name: "High-Risk Jurisdiction",
			Description: "Transactions involving FATF grey/blacklist countries",
			Type: PatternHighRiskJuris, Threshold: 0,
			TimeWindow: 0, Severity: SeverityHigh,
		},
		{
			ID: "pat_dormant", Name: "Dormant Account Activity",
			Description: "Sudden activity after 6+ months dormancy",
			Type: PatternDormantActivity, Threshold: 0,
			TimeWindow: 180 * 24 * time.Hour, Severity: SeverityMedium,
		},
	}
}

// NewTxnPattern validates and creates a pattern.
func NewTxnPattern(name string, ptype TxnPatternType) (TxnPattern, error) {
	if name == "" {
		return TxnPattern{}, fmt.Errorf("pattern name required")
	}
	return TxnPattern{
		ID:   fmt.Sprintf("pat_%d", time.Now().UnixNano()),
		Name: name, Type: ptype,
		Severity: SeverityMedium,
	}, nil
}
