package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// MergeDuplicates merges metadata from duplicates into the primary.
func MergeDuplicates(primary domain.Entity, dupes []domain.Entity) domain.Entity {
	for _, d := range dupes {
		for _, alias := range d.Names {
			if !hasName(primary.Names, alias) {
				primary.Names = append(primary.Names, alias)
			}
		}
		for _, nat := range d.Nationalities {
			addUnique(&primary.Nationalities, nat)
		}
		for _, ident := range d.Identifiers {
			primary.Identifiers = append(primary.Identifiers, ident)
		}
		if primary.DOB == nil && d.DOB != nil {
			primary.DOB = d.DOB
		}
		for k, v := range d.Metadata {
			if _, exists := primary.Metadata[k]; !exists {
				primary.Metadata[k] = v
			}
		}
	}
	return primary
}
