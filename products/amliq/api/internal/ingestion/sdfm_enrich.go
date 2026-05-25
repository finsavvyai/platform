package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// enrichSDFM populates metadata, aliases, address, and nationality
// on an already-constructed SDFM entity.
func enrichSDFM(ent *domain.Entity, r *sdfmRecord, aliases []string) {
	setMeta(ent, "program", strings.TrimSpace(r.Program))
	if dob := strings.TrimSpace(r.DOB); dob != "" {
		setMeta(ent, "dob", dob)
		parseDOB(ent, dob)
	}
	comments := strings.TrimSpace(r.Comments)
	setMeta(ent, "comments", comments)
	setMeta(ent, "remarks", comments)

	if len(aliases) > 0 {
		setMeta(ent, "aliases", strings.Join(aliases, "; "))
		for _, alias := range aliases {
			if alias == "" {
				continue
			}
			if n, err := domain.NewName(alias, "", "", ""); err == nil {
				ent.Names = append(ent.Names, n)
			}
		}
	}
	if addr := strings.TrimSpace(r.Address); addr != "" {
		ent.Addresses = append(ent.Addresses, addr)
	}
	if nat := strings.TrimSpace(r.Nationality); nat != "" {
		ent.Nationalities = append(ent.Nationalities, nat)
	}
}
