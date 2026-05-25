package domain

import "fmt"

type AlertStatus int

const (
	AlertStatusUnknown AlertStatus = iota
	AlertStatusPending
	AlertStatusInProgress
	AlertStatusResolved
	AlertStatusEscalated
)

func (as AlertStatus) String() string {
	switch as {
	case AlertStatusPending:
		return "Pending"
	case AlertStatusInProgress:
		return "InProgress"
	case AlertStatusResolved:
		return "Resolved"
	case AlertStatusEscalated:
		return "Escalated"
	default:
		return "Unknown"
	}
}

func ParseAlertStatus(s string) (AlertStatus, error) {
	switch s {
	case "Pending":
		return AlertStatusPending, nil
	case "InProgress":
		return AlertStatusInProgress, nil
	case "Resolved":
		return AlertStatusResolved, nil
	case "Escalated":
		return AlertStatusEscalated, nil
	default:
		return AlertStatusUnknown, fmt.Errorf("invalid alert status: %s", s)
	}
}
