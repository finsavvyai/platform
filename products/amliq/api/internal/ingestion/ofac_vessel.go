package ingestion

import (
	"strconv"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func parseVesselFields(rec []string, ent *domain.Entity) {
	if len(rec) < 12 {
		return
	}

	// Extract vessel-specific fields from remarks column (col 10+)
	remarks := ""
	if len(rec) > 10 {
		remarks = strings.TrimSpace(rec[10])
	}

	// Parse IMO number from remarks (e.g., "IMO: 1234567")
	imo := extractFieldFromRemarks(remarks, "IMO")
	if imo != "" {
		setMeta(ent, "imo", imo)
	}

	// Parse flag from remarks or col 12 if available
	flag := extractFieldFromRemarks(remarks, "Flag")
	if flag == "" && len(rec) > 12 {
		flag = strings.TrimSpace(rec[12])
	}
	if flag != "" {
		setMeta(ent, "flag", flag)
	}

	// Parse call sign
	callSign := extractFieldFromRemarks(remarks, "Call Sign")
	if callSign != "" {
		setMeta(ent, "call_sign", callSign)
	}

	// Parse tonnage
	tonnage := extractFieldFromRemarks(remarks, "Tonnage")
	if tonnage != "" {
		setMeta(ent, "tonnage", tonnage)
	}

	// Parse vessel type
	vesselType := extractFieldFromRemarks(remarks, "Type")
	if vesselType != "" {
		setMeta(ent, "vessel_type", vesselType)
	}

	// Parse MMSI
	mmsi := extractFieldFromRemarks(remarks, "MMSI")
	if mmsi != "" {
		setMeta(ent, "mmsi", mmsi)
	}

	// Parse owner
	owner := extractFieldFromRemarks(remarks, "Owner")
	if owner != "" {
		setMeta(ent, "owner", owner)
	}

	// Parse year built
	yearBuilt := extractFieldFromRemarks(remarks, "Built")
	if yearBuilt != "" {
		if y, err := strconv.Atoi(yearBuilt); err == nil {
			setMeta(ent, "built", strconv.Itoa(y))
		}
	}
}

func extractFieldFromRemarks(remarks, fieldName string) string {
	parts := strings.Split(remarks, ";")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, fieldName+":") {
			val := strings.TrimSpace(strings.TrimPrefix(part, fieldName+":"))
			return val
		}
	}
	return ""
}
