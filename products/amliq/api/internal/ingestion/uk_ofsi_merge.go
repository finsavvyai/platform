package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// mergeUKOFSIAlias folds a duplicate-Group-ID row's name and any
// new identifiers into the previously-seen entity. The OFSI CSV
// publishes one row per alias (sharing Group ID); without this
// merge every alias name is silently dropped because Parse dedupes
// by group key.
func mergeUKOFSIAlias(dst *domain.Entity, src domain.Entity) {
	primary := ""
	if len(dst.Names) > 0 {
		primary = dst.Names[0].Full
	}
	for _, n := range src.Names {
		if n.Full == "" || n.Full == primary {
			continue
		}
		if !ukOFSIHasName(dst.Names, n.Full) {
			dst.Names = append(dst.Names, n)
		}
	}
	dst.Identifiers = append(dst.Identifiers, src.Identifiers...)
	for _, a := range src.Addresses {
		addUnique(&dst.Addresses, a)
	}
}

func ukOFSIHasName(names []domain.Name, want string) bool {
	for _, n := range names {
		if n.Full == want {
			return true
		}
	}
	return false
}
