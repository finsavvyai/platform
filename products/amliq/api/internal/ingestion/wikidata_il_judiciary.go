package ingestion

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// WikidataILJudiciaryURL pulls Israeli judges, justices and central
// bankers from Wikidata in a single SPARQL query.
//
// Coverage: 298 distinct persons (last counted 2026-04-27 against
// the live Wikidata SPARQL endpoint with the same VALUES list).
// Earlier estimate of ~580–900 was wrong — replaced after live
// verification.
//
// Occupation Q-IDs:
//
//	Q16533     judge
//	Q211236    central banker
//	Q16267607  justice (subset of judge but separately tagged on Wikidata)
//
// Per FATF: Tier-2 senior official (national judiciary + central bank
// governance). Refine the VALUES list to add prosecutors (Q174379),
// attorneys general (Q1335141) etc. when you want to widen coverage.
const WikidataILJudiciaryURL = "https://query.wikidata.org/sparql?format=json&query=" +
	"SELECT%20DISTINCT%20%3Fperson%20%3FpersonLabel%20%3FpersonHeLabel%20%3FoccLabel%20%3Fdob%20WHERE%20%7B%0A" +
	"%20%20%3Fperson%20wdt%3AP27%20wd%3AQ801%20.%0A" +
	"%20%20%3Fperson%20wdt%3AP106%20%3Focc%20.%0A" +
	"%20%20VALUES%20%3Focc%20%7B%20wd%3AQ16533%20wd%3AQ211236%20wd%3AQ16267607%20%7D%0A" +
	"%20%20OPTIONAL%20%7B%20%3Fperson%20wdt%3AP569%20%3Fdob%20%7D%0A" +
	"%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22en%2Che%22%20%7D%0A" +
	"%7D%20LIMIT%202000"

type WikidataILJudiciaryParser struct{}

func NewWikidataILJudiciaryParser() *WikidataILJudiciaryParser {
	return &WikidataILJudiciaryParser{}
}

func (p *WikidataILJudiciaryParser) Parse(data []byte) ([]domain.Entity, error) {
	var resp sparqlResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("wikidata judiciary: parse json: %w", err)
	}
	seen := make(map[string]bool)
	out := make([]domain.Entity, 0, len(resp.Results.Bindings))
	for _, b := range resp.Results.Bindings {
		qid := lastSegment(b.Value("person"))
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

		id, err := domain.NewEntityID(sanitizeBulkID("wd_il_jud_" + qid))
		if err != nil {
			continue
		}
		n, _ := domain.NewName(NormalizeName(primary), "", "", "")
		ent, err := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{n})
		if err != nil {
			continue
		}
		ent.ListID = "wikidata_il_judiciary"
		ent.Nationalities = []string{"IL"}
		if dob, ok := parseSparqlDate(b.Value("dob")); ok {
			ent.DOB = &dob
		}
		occ := strings.TrimSpace(b.Value("occLabel"))
		if occ == "" {
			occ = "Judiciary / Central Banker"
		}
		ent.PositionTitle = strings.Title(occ)
		ent.PEPTier = domain.PEPTier2
		out = append(out, ent)
	}
	return out, nil
}
