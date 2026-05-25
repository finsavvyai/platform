package domain

import (
	"fmt"
	"strings"
)

type SubscriptionStatus string

const (
	StatusTrialing  SubscriptionStatus = "trialing"
	StatusActive    SubscriptionStatus = "active"
	StatusPastDue   SubscriptionStatus = "past_due"
	StatusPaused    SubscriptionStatus = "paused"
	StatusCancelled SubscriptionStatus = "cancelled"
	StatusExpired   SubscriptionStatus = "expired"
)

func ParseSubscriptionStatus(s string) (SubscriptionStatus, error) {
	status := SubscriptionStatus(strings.ToLower(s))
	switch status {
	case StatusTrialing, StatusActive, StatusPastDue, StatusPaused, StatusCancelled, StatusExpired:
		return status, nil
	default:
		return "", fmt.Errorf("invalid subscription status: %s", s)
	}
}

func (s SubscriptionStatus) String() string {
	return string(s)
}

func (s SubscriptionStatus) IsActive() bool {
	switch s {
	case StatusTrialing, StatusActive:
		return true
	default:
		return false
	}
}

func (s SubscriptionStatus) DisplayName() string {
	switch s {
	case StatusTrialing:
		return "Trialing"
	case StatusActive:
		return "Active"
	case StatusPastDue:
		return "Past Due"
	case StatusPaused:
		return "Paused"
	case StatusCancelled:
		return "Cancelled"
	case StatusExpired:
		return "Expired"
	default:
		return string(s)
	}
}

func (s SubscriptionStatus) IsValid() bool {
	switch s {
	case StatusTrialing, StatusActive, StatusPastDue, StatusPaused, StatusCancelled, StatusExpired:
		return true
	default:
		return false
	}
}
