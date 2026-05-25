package ingestion

import (
	"strings"
	"time"
)

// parseDateBestEffort tries every known DOB/DOD layout and returns
// the zero time if none match. Exists so callers can skip the
// entity-pointer indirection of parseDOB when they just want a time.
func parseDateBestEffort(raw string) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}
	}
	if strings.Contains(raw, ";") {
		raw = strings.TrimSpace(strings.SplitN(raw, ";", 2)[0])
	}
	for _, layout := range dobLayouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return t
		}
	}
	return time.Time{}
}
