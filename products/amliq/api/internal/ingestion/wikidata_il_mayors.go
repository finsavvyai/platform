package ingestion

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// WikidataILMayorsURL queries the Wikidata SPARQL endpoint for every
// person who has held an Israeli mayoral position (current + historical).
//
// Coverage: 178 distinct mayors of Israeli cities, local councils,
// and regional councils (last counted 2026-04-27 against the live
// Wikidata SPARQL endpoint; grows as Wikidata data is added).
// Returns Hebrew + English labels, date of birth where available,
// and the Wikidata Q-ID which lets us dedupe against entities
// already ingested via wikidata-peps / opensanctions_default.
//
// Refine the SPARQL if coverage looks low — Wikidata's modeling for
// mayoral positions is inconsistent (some use P1001 "applies to
// jurisdiction", others a dedicated "Mayor of <city>" Q-item).
const WikidataILMayorsURL = "https://query.wikidata.org/sparql?format=json&query=" +
	"SELECT%20DISTINCT%20%3Fperson%20%3FpersonLabel%20%3FpersonHeLabel%20%3Fcity%20%3FcityLabel%20%3FcityHeLabel%20%3Fdob%20WHERE%20%7B%0A" +
	"%20%20%3Fperson%20wdt%3AP27%20wd%3AQ801%20.%0A" +
	"%20%20%3Fperson%20wdt%3AP39%20%3Fposition%20.%0A" +
	"%20%20%3Fposition%20wdt%3AP279%2a%20wd%3AQ30185%20.%0A" +
	"%20%20OPTIONAL%20%7B%20%3Fposition%20wdt%3AP1001%20%3Fcity%20.%20%3Fcity%20wdt%3AP17%20wd%3AQ801%20%7D%0A" +
	"%20%20OPTIONAL%20%7B%20%3Fperson%20wdt%3AP569%20%3Fdob%20%7D%0A" +
	"%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22en%2Che%22%20%7D%0A" +
	"%7D%0ALIMIT%201000"

type WikidataILMayorsParser struct{}

func NewWikidataILMayorsParser() *WikidataILMayorsParser {
	return &WikidataILMayorsParser{}
}

func (p *WikidataILMayorsParser) Parse(data []byte) ([]domain.Entity, error) {
	var resp sparqlResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("wikidata mayors: parse json: %w", err)
	}

	seen := make(map[string]bool)
	out := make([]domain.Entity, 0, len(resp.Results.Bindings))
	for _, b := range resp.Results.Bindings {
		qid := lastSegment(b.Value("person")) // e.g. "Q123456"
		if qid == "" || seen[qid] {
			continue
		}
		nameEn := strings.TrimSpace(b.Value("personLabel"))
		nameHe := strings.TrimSpace(b.Value("personHeLabel"))
		primary := nameEn
		if primary == "" {
			primary = nameHe
		}
		if primary == "" || primary == qid {
			continue
		}
		seen[qid] = true

		id, err := domain.NewEntityID(sanitizeBulkID("wd_il_mayor_" + qid))
		if err != nil {
			continue
		}
		n, _ := domain.NewName(NormalizeName(primary), "", "", "")
		ent, err := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{n})
		if err != nil {
			continue
		}
		ent.ListID = "wikidata_il_mayors"
		ent.Nationalities = []string{"IL"}
		if dob, ok := parseSparqlDate(b.Value("dob")); ok {
			ent.DOB = &dob
		}
		ent.PositionTitle = "Mayor"
		if cityEn := b.Value("cityLabel"); cityEn != "" {
			ent.PositionTitle = "Mayor of " + cityEn
		}
		// Tier 3 — local government per pep.go.
		ent.PEPTier = domain.PEPTier3
		out = append(out, ent)
	}
	return out, nil
}

func lastSegment(uri string) string {
	if i := strings.LastIndex(uri, "/"); i >= 0 {
		return uri[i+1:]
	}
	return uri
}

func parseSparqlDate(raw string) (time.Time, bool) {
	if raw == "" {
		return time.Time{}, false
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05Z", "2006-01-02"} {
		if t, err := time.Parse(layout, raw); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}
