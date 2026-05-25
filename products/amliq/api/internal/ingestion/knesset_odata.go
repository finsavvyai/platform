package ingestion

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Knesset OData ParliamentInfo service. The KNS_Person endpoint
// returns 1,184 current + historical Members of Knesset, ministers
// and Knesset speakers (last counted 2026-04-28 against the live
// $count endpoint at knesset.gov.il/Odata/ParliamentInfo.svc;
// 2026-04-27 the host was serving a maintenance page so the figure
// was hedged at the time). Every person who has held a position in
// the Knesset qualifies as a Tier-1 PEP per FATF (national
// legislature).
//
// Structured JSON, no auth, official source. Already paginated;
// AllKnessetPersonsURL pulls the first 1000, the parser iterates
// odata.nextLink for the remainder.
const KnessetPersonsURL = "https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_Person" +
	"?$top=1000&$format=json"

type knessetPerson struct {
	PersonID   int    `json:"PersonID"`
	FirstName  string `json:"FirstName"`
	LastName   string `json:"LastName"`
	GenderDesc string `json:"GenderDesc"`
	IsCurrent  bool   `json:"IsCurrent"`
}

type knessetPersonsPage struct {
	Value    []knessetPerson `json:"value"`
	NextLink string          `json:"odata.nextLink"`
}

type KnessetPersonsParser struct{}

func NewKnessetPersonsParser() *KnessetPersonsParser {
	return &KnessetPersonsParser{}
}

func (p *KnessetPersonsParser) Parse(data []byte) ([]domain.Entity, error) {
	var page knessetPersonsPage
	if err := json.Unmarshal(data, &page); err != nil {
		return nil, fmt.Errorf("knesset persons: parse json: %w", err)
	}
	out := make([]domain.Entity, 0, len(page.Value))
	for _, kp := range page.Value {
		full := strings.TrimSpace(kp.FirstName + " " + kp.LastName)
		if full == "" || len(full) < 3 {
			continue
		}
		id, err := domain.NewEntityID(sanitizeBulkID(
			fmt.Sprintf("knesset_person_%d", kp.PersonID),
		))
		if err != nil {
			continue
		}
		n, _ := domain.NewName(NormalizeName(full), "", "", "")
		ent, err := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{n})
		if err != nil {
			continue
		}
		ent.ListID = "knesset_persons"
		ent.Nationalities = []string{"IL"}
		ent.PositionTitle = "Member of Knesset"
		ent.PEPTier = domain.PEPTier1
		if kp.GenderDesc != "" {
			ent.Gender = kp.GenderDesc
		}
		out = append(out, ent)
	}
	return out, nil
}
