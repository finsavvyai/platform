package billing

import (
	"fmt"
	"time"
)

// CurrentPeriod returns the current billing period as YYYY-MM.
func CurrentPeriod() string {
	now := time.Now().UTC()
	return fmt.Sprintf("%04d-%02d", now.Year(), now.Month())
}

// Alias for internal use.
func currentPeriod() string {
	return CurrentPeriod()
}
