package domain

import "fmt"

type AlertPriority int

const (
	AlertPriorityUnknown AlertPriority = iota
	AlertPriorityCritical
	AlertPriorityHigh
	AlertPriorityMedium
	AlertPriorityLow
)

func (ap AlertPriority) String() string {
	switch ap {
	case AlertPriorityCritical:
		return "Critical"
	case AlertPriorityHigh:
		return "High"
	case AlertPriorityMedium:
		return "Medium"
	case AlertPriorityLow:
		return "Low"
	default:
		return "Unknown"
	}
}

func PriorityFromConfidence(conf Confidence) AlertPriority {
	switch {
	case conf.Score() >= 0.95:
		return AlertPriorityCritical
	case conf.Score() >= 0.80:
		return AlertPriorityHigh
	case conf.Score() >= 0.50:
		return AlertPriorityMedium
	default:
		return AlertPriorityLow
	}
}

func ParseAlertPriority(s string) (AlertPriority, error) {
	switch s {
	case "Critical":
		return AlertPriorityCritical, nil
	case "High":
		return AlertPriorityHigh, nil
	case "Medium":
		return AlertPriorityMedium, nil
	case "Low":
		return AlertPriorityLow, nil
	default:
		return AlertPriorityUnknown, fmt.Errorf("invalid priority: %s", s)
	}
}
