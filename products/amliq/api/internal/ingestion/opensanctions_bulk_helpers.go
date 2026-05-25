package ingestion

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

var schemaTypeMap = map[string]domain.EntityType{
	"Person":       domain.EntityTypeIndividual,
	"Organization": domain.EntityTypeCompany,
	"Company":      domain.EntityTypeCompany,
	"LegalEntity":  domain.EntityTypeCompany,
	"Vessel":       domain.EntityTypeVessel,
	"Airplane":     domain.EntityTypeAircraft,
}

func mapSchemaType(schema string) domain.EntityType {
	if t, ok := schemaTypeMap[schema]; ok {
		return t
	}
	return domain.EntityTypeUnknown
}

func sanitizeBulkID(raw string) string {
	h := sha256.Sum256([]byte(raw))
	hex12 := hex.EncodeToString(h[:])[:12]
	return "ent_" + hex12
}

// setBulkMeta enriches the entity with all OpenSanctions properties
// and header-level fields so the frontend can show rich detail.
func setBulkMeta(
	ent *domain.Entity,
	props map[string][]string,
	hdr headerIndex,
	rec []string,
) {
	enrichBulkFromProps(ent, props)
	enrichBulkFromHeader(ent, hdr, rec)
}

func firstSlice(vals []string) string {
	if len(vals) > 0 {
		return strings.TrimSpace(vals[0])
	}
	return ""
}

func parseProperties(raw string) map[string][]string {
	var props map[string][]string
	if raw != "" {
		_ = json.Unmarshal([]byte(raw), &props)
	}
	if props == nil {
		props = make(map[string][]string)
	}
	return props
}

func pickName(caption string, props map[string][]string) string {
	if caption != "" {
		return caption
	}
	if names, ok := props["name"]; ok && len(names) > 0 {
		return names[0]
	}
	return ""
}

func mapDatasetToListID(datasets string) string {
	mapping := map[string]string{
		"us_ofac_sdn": "us_ofac_sdn", "un_sc_sanctions": "un_sc_sanctions",
		"eu_fsf": "eu_fsf", "uk_ofsi": "uk_ofsi",
	}
	for key, listID := range mapping {
		if strings.Contains(datasets, key) {
			return listID
		}
	}
	return "opensanctions_default"
}
