package publicdemo

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// toDomainEntities converts every fixture entry across the provided
// lists into a flat slice of domain.Entity, tagged with its source
// list_id. Each entry yields one Entity with PrimaryName + Aliases.
func toDomainEntities(lists []FixtureList) ([]domain.Entity, map[string]string) {
	out := make([]domain.Entity, 0, 64)
	listByEntityID := make(map[string]string, 64)
	for _, lst := range lists {
		for _, e := range lst.Entries {
			ent, ok := buildEntity(e, lst.ListID)
			if !ok {
				continue
			}
			out = append(out, ent)
			listByEntityID[ent.ID.String()] = lst.ListID
		}
	}
	return out, listByEntityID
}

// buildEntity translates a FixtureEntry into a domain.Entity. Returns
// (Entity{}, false) if the fixture is malformed.
func buildEntity(e FixtureEntry, listID string) (domain.Entity, bool) {
	names := make([]domain.Name, 0, 1+len(e.Aliases))
	pn, err := domain.NewName(e.PrimaryName, "", "", "")
	if err != nil {
		return domain.Entity{}, false
	}
	names = append(names, pn)
	for _, a := range e.Aliases {
		an, err := domain.NewName(a, "", "", "")
		if err != nil {
			continue
		}
		names = append(names, an)
	}
	id, err := domain.NewEntityID(sanitizeID(e.EntityID))
	if err != nil {
		return domain.Entity{}, false
	}
	typ := parseEntityType(e.Type)
	ent, err := domain.NewEntity(id, typ, names)
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = listID
	if len(e.Country) > 0 {
		ent.Nationalities = []string{e.Country}
	}
	return ent, true
}

// sanitizeID strips characters that fail the EntityID regex while
// keeping the original ID human-recognisable.
func sanitizeID(raw string) string {
	if raw == "" {
		return "ent_unknown"
	}
	b := make([]byte, 0, len(raw))
	for i := 0; i < len(raw); i++ {
		c := raw[i]
		switch {
		case c >= 'a' && c <= 'z',
			c >= 'A' && c <= 'Z',
			c >= '0' && c <= '9',
			c == '_', c == '-', c == '.':
			b = append(b, c)
		}
	}
	if len(b) < 2 {
		return "ent_" + raw
	}
	return string(b)
}

func parseEntityType(s string) domain.EntityType {
	t, err := domain.ParseEntityType(s)
	if err != nil {
		return domain.EntityTypeUnknown
	}
	return t
}

// buildQueryEntity wraps the user's query name as a domain.Entity so it
// can be fed to the screening engine.
func buildQueryEntity(name string) (domain.Entity, error) {
	qn, err := domain.NewName(name, "", "", "")
	if err != nil {
		return domain.Entity{}, fmt.Errorf("invalid name: %w", err)
	}
	id, _ := domain.NewEntityID("ent_publicdemo01")
	e, err := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{qn})
	if err != nil {
		return domain.Entity{}, err
	}
	return e, nil
}

// projectMatches maps the engine's MatchResult slice into the public-demo
// Match shape, joining each result with its source list_id and the
// entity's primary display name.
func projectMatches(
	results []domain.MatchResult,
	listByEntityID map[string]string,
	entityIndex map[string]domain.Entity,
) []Match {
	out := make([]Match, 0, len(results))
	for _, r := range results {
		eid := r.EntityID.String()
		m := Match{
			EntityID:   eid,
			EntityName: displayName(entityIndex[eid]),
			Confidence: r.Confidence.Score(),
			Lists:      []string{listByEntityID[eid]},
			Layers:     projectLayers(r.Evidence),
			PEPStatus:  PEPNone(),
		}
		out = append(out, m)
	}
	return out
}

func displayName(e domain.Entity) string {
	if len(e.Names) == 0 {
		return ""
	}
	return strings.TrimSpace(e.Names[0].Full)
}

// projectLayers reduces the evidence slice to one row per layer, keeping
// the highest-scoring matched value for that layer.
func projectLayers(ev []domain.MatchEvidence) []LayerResult {
	best := map[string]LayerResult{}
	for _, e := range ev {
		layer := e.Layer.String()
		cur, ok := best[layer]
		if !ok || e.Score > cur.Score {
			best[layer] = LayerResult{
				Layer:   layer,
				Score:   e.Score,
				Matched: e.MatchedValue,
			}
		}
	}
	out := make([]LayerResult, 0, len(best))
	for _, layer := range []string{"Exact", "Fuzzy", "Phonetic", "Token", "Embedding"} {
		if lr, ok := best[layer]; ok {
			out = append(out, lr)
		}
	}
	return out
}
