package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// extractOFACAliases scans OFAC remarks for "a.k.a." patterns and
// promotes each alias into ent.Names so marshalRichCols serializes
// it into the `aliases` JSONB column. Duplicates and the primary
// name are filtered out.
func extractOFACAliases(ent *domain.Entity, remarks string) {
	aliases := collectOFACAKAs(remarks)
	if len(aliases) == 0 {
		return
	}
	setMeta(ent, "aliases", strings.Join(aliases, "; "))
	primary := ""
	if len(ent.Names) > 0 {
		primary = ent.Names[0].Full
	}
	for _, a := range aliases {
		if a == primary {
			continue
		}
		if n, err := domain.NewName(a, "", "", ""); err == nil {
			ent.Names = append(ent.Names, n)
		}
	}
}

// collectOFACAKAs walks the remarks string and returns every "a.k.a"
// alias phrase, each trimmed of punctuation and capped at the next
// semicolon.
func collectOFACAKAs(remarks string) []string {
	var out []string
	for {
		lower := strings.ToLower(remarks)
		idx := strings.Index(lower, "a.k.a")
		if idx == -1 {
			return out
		}
		start := idx + len("a.k.a")
		rest := strings.TrimSpace(remarks[start:])
		if pos := strings.Index(rest, ";"); pos != -1 {
			rest = rest[:pos]
		}
		rest = strings.TrimLeft(rest, ".: '\"")
		rest = strings.TrimRight(rest, "'\" ")
		if rest != "" {
			out = append(out, rest)
		}
		if start >= len(remarks) {
			return out
		}
		remarks = remarks[start:]
	}
}
