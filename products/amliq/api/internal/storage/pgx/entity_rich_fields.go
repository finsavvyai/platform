package pgx

import (
	"encoding/json"

	"github.com/aegis-aml/aegis/internal/domain"
)

// identifierJSON is the on-disk shape of a secondary identifier.
// Keeping it small and local keeps the SELECT column count low and
// makes rolling-forward schema changes easier.
type identifierJSON struct {
	Type    string `json:"type"`
	Value   string `json:"value"`
	Country string `json:"country,omitempty"`
}

// marshalRichCols returns the three JSONB byte slices for the new
// `addresses`, `identifiers`, `aliases` columns. Any slice that is
// empty is returned as nil so the column is stored as NULL rather
// than an empty JSON array.
func marshalRichCols(ent domain.Entity) (addrs, ids, aliases []byte) {
	if len(ent.Addresses) > 0 {
		addrs, _ = json.Marshal(ent.Addresses)
	}
	if len(ent.Identifiers) > 0 {
		out := make([]identifierJSON, len(ent.Identifiers))
		for i, id := range ent.Identifiers {
			out[i] = identifierJSON{
				Type:    string(id.Type),
				Value:   id.Value,
				Country: id.Country,
			}
		}
		ids, _ = json.Marshal(out)
	}
	if len(ent.Names) > 1 {
		extras := make([]string, 0, len(ent.Names)-1)
		for _, n := range ent.Names[1:] {
			if n.Full != "" {
				extras = append(extras, n.Full)
			}
		}
		if len(extras) > 0 {
			aliases, _ = json.Marshal(extras)
		}
	}
	return addrs, ids, aliases
}

// applyRichCols fills Addresses, Identifiers, and the alias tail of
// Names from the three JSONB byte slices fetched alongside the rest
// of the entity row. Absent / malformed columns are tolerated — the
// entity is simply left without that enrichment rather than failing
// the whole scan.
func applyRichCols(ent *domain.Entity, addrs, ids, aliases []byte) {
	if len(addrs) > 0 {
		var out []string
		if err := json.Unmarshal(addrs, &out); err == nil {
			ent.Addresses = out
		}
	}
	if len(ids) > 0 {
		var raw []identifierJSON
		if err := json.Unmarshal(ids, &raw); err == nil {
			built := make([]domain.Identifier, 0, len(raw))
			for _, r := range raw {
				id, err := domain.NewIdentifier(
					domain.IdentifierType(r.Type), r.Value, r.Country)
				if err == nil {
					built = append(built, id)
				}
			}
			ent.Identifiers = built
		}
	}
	if len(aliases) > 0 {
		var names []string
		if err := json.Unmarshal(aliases, &names); err == nil {
			for _, n := range names {
				if name, err := domain.NewName(n, "", "", ""); err == nil {
					ent.Names = append(ent.Names, name)
				}
			}
		}
	}
}
