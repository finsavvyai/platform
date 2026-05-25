package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// MandatoryListIDs are the lists every regulated-AML tenant must
// screen against regardless of their per-tenant EnabledLists config.
// Tenant admins CAN adjust threshold / schedule, but cannot disable.
// Keep this list tight — everything else is discretionary.
var MandatoryListIDs = map[string]bool{
	"ofac-sdn":              true,
	"un":                    true,
	"eu_fsf":                true,
	"uk_ofsi":               true,
	"opensanctions_default": true,
	"israeli_treasury":      true,
}

// MandatoryLists returns the ListConfig slice for the mandatory IDs,
// pulled from AllMajorLists so schedule/threshold stay single-sourced.
func MandatoryLists() []domain.ListConfig {
	out := make([]domain.ListConfig, 0, len(MandatoryListIDs))
	for _, lc := range AllMajorLists() {
		if MandatoryListIDs[lc.ListID] {
			out = append(out, lc)
		}
	}
	return out
}

// IsMandatory reports whether a list ID is in the regulatory baseline.
func IsMandatory(listID string) bool { return MandatoryListIDs[listID] }
