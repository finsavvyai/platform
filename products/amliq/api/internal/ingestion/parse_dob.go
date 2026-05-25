package ingestion

import (
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// parseDOB attempts to parse a date-of-birth string and set it
// on the entity. Supports ISO 8601 full dates and year-only.
func parseDOB(ent *domain.Entity, raw string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return
	}
	// Try common date formats
	for _, layout := range dobLayouts {
		if t, err := time.Parse(layout, raw); err == nil {
			ent.DOB = &t
			return
		}
	}
	// Handle semicolon-separated multiple DOBs (take first)
	if strings.Contains(raw, ";") {
		first := strings.TrimSpace(strings.SplitN(raw, ";", 2)[0])
		parseDOBSingle(ent, first)
	}
}

func parseDOBSingle(ent *domain.Entity, s string) {
	for _, layout := range dobLayouts {
		if t, err := time.Parse(layout, s); err == nil {
			ent.DOB = &t
			return
		}
	}
}

var dobLayouts = []string{
	"2006-01-02",
	"2006-01",
	"2006",
	"01/02/2006",
	"02/01/2006",
	"2006-01-02T15:04:05",
	"Jan 2, 2006",
	"2 Jan 2006",
}
