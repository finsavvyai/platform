package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// buildFTMEntity constructs a domain.Entity from one FTM JSON line.
// Returns ok=false when the line lacks the minimum data (id + name).
func buildFTMEntity(ft ftmFullEntity) (domain.Entity, bool) {
	if ft.ID == "" {
		return domain.Entity{}, false
	}
	name := resolveFTMName(ft)
	if name == "" {
		return domain.Entity{}, false
	}
	id, err := domain.NewEntityID(sanitizeBulkID(ft.ID))
	if err != nil {
		return domain.Entity{}, false
	}
	domainName, _ := domain.NewName(name, "", "", "")
	ent, err := domain.NewEntity(id, mapPEPType(ft.Schema), []domain.Name{domainName})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "opensanctions_peps"
	setMeta(&ent, "dataset", firstSliceStr(ft.Datasets))
	setMeta(&ent, "schemaType", ft.Schema)
	setMeta(&ent, "first_seen", ft.FirstSeen)
	setMeta(&ent, "last_seen", ft.LastSeen)
	setMeta(&ent, "last_change", ft.LastChange)
	enrichFTMCore(&ent, ft.Properties)
	enrichFTMIdentity(&ent, ft.Properties)
	enrichFTMContact(&ent, ft.Properties)
	return ent, true
}

// resolveFTMName prefers the caption (human-readable), then the
// "name" property array, then a firstName + lastName composition.
func resolveFTMName(ft ftmFullEntity) string {
	if ft.Caption != "" {
		return NormalizeName(ft.Caption)
	}
	if n := firstSliceStr(ft.Properties["name"]); n != "" {
		return NormalizeName(n)
	}
	first := firstSliceStr(ft.Properties["firstName"])
	last := firstSliceStr(ft.Properties["lastName"])
	if first == "" && last == "" {
		return ""
	}
	return NormalizeName(joinNonEmpty(first, last))
}

// firstSliceStr returns the first non-empty element of a string
// slice, or empty string.
func firstSliceStr(s []string) string {
	for _, v := range s {
		if v != "" {
			return v
		}
	}
	return ""
}
