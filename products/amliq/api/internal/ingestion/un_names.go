package ingestion

import "strings"

// extractUNNames builds a deduplicated name list from main name parts,
// original script name, and aliases.
func extractUNNames(
	first, second, third, fourth, origScript string,
	aliases []unAlias,
) []string {
	var names []string

	mainName := joinNonEmpty(
		strings.TrimSpace(first),
		strings.TrimSpace(second),
		strings.TrimSpace(third),
		strings.TrimSpace(fourth),
	)
	if mainName != "" {
		names = append(names, mainName)
	}
	if orig := strings.TrimSpace(origScript); orig != "" {
		addUnique(&names, orig)
	}

	for _, a := range aliases {
		aliasName := resolveAliasName(a)
		if aliasName != "" {
			addUnique(&names, aliasName)
		}
	}
	return names
}

// resolveAliasName picks the best alias representation.
func resolveAliasName(a unAlias) string {
	if n := strings.TrimSpace(a.AliasName); n != "" {
		return n
	}
	composed := joinNonEmpty(
		strings.TrimSpace(a.FirstName),
		strings.TrimSpace(a.SecondName),
		strings.TrimSpace(a.ThirdName),
		strings.TrimSpace(a.FourthName),
	)
	return composed
}

// choosePrimaryLatinName picks the first name containing Latin letters.
// Falls back to the first name in the list.
func choosePrimaryLatinName(names []string) string {
	for _, n := range names {
		if containsLatinLetter(n) {
			return n
		}
	}
	if len(names) > 0 {
		return names[0]
	}
	return ""
}

// filterAliases returns all names except the primary.
func filterAliases(names []string, primary string) []string {
	var out []string
	for _, n := range names {
		if n != primary && n != "" {
			out = append(out, n)
		}
	}
	return out
}
