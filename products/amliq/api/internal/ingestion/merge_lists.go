package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// mergeLists unions mandatory + tenant lists. Tenant entries win on
// overlap (so admins can override threshold/schedule on mandatory
// lists) EXCEPT SyncEnabled, which mandatory always forces true.
func mergeLists(mandatory, tenant []domain.ListConfig) []domain.ListConfig {
	byID := make(map[string]domain.ListConfig, len(mandatory)+len(tenant))
	for _, lc := range mandatory {
		byID[lc.ListID] = lc
	}
	for _, lc := range tenant {
		if base, ok := byID[lc.ListID]; ok {
			lc.SyncEnabled = base.SyncEnabled // force-on for mandatory
		}
		byID[lc.ListID] = lc
	}
	out := make([]domain.ListConfig, 0, len(byID))
	for _, lc := range byID {
		out = append(out, lc)
	}
	return out
}
