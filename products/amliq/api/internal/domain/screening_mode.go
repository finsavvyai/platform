package domain

import "fmt"

// ScreeningMode represents the screening execution model.
type ScreeningMode int

const (
	ScreeningModeRealtime ScreeningMode = iota
	ScreeningModeBatch
	ScreeningModeBoth
)

// String returns the string representation.
func (sm ScreeningMode) String() string {
	switch sm {
	case ScreeningModeRealtime:
		return "Realtime"
	case ScreeningModeBatch:
		return "Batch"
	case ScreeningModeBoth:
		return "Both"
	default:
		return "Unknown"
	}
}

// ParseScreeningMode parses a string into a ScreeningMode.
func ParseScreeningMode(s string) (ScreeningMode, error) {
	switch s {
	case "Realtime", "realtime":
		return ScreeningModeRealtime, nil
	case "Batch", "batch":
		return ScreeningModeBatch, nil
	case "Both", "both":
		return ScreeningModeBoth, nil
	default:
		return ScreeningModeRealtime, fmt.Errorf("invalid screening mode: %s", s)
	}
}
