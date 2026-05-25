package ingestion

import (
	"bytes"
	"encoding/csv"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Development bank sanctions list URLs.
const (
	ADBSanctionsURL  = "https://www.adb.org/sites/default/files/page/536511/oi-sanctioned-list.csv"
	EBRDSanctionsURL = "https://www.ebrd.com/integrity-and-compliance/enforcement.html"
	IADBSanctionsURL = "https://www.iadb.org/en/transparency/sanctioned-firms-and-individuals"
)

// DevBankParser parses development bank sanctions CSV files.
// Works for ADB, EBRD, IADB — all use similar CSV formats.
type DevBankParser struct {
	listID string
}

func NewADBParser() *DevBankParser  { return &DevBankParser{listID: "adb_sanctions"} }
func NewEBRDParser() *DevBankParser { return &DevBankParser{listID: "ebrd_ineligible"} }

func (p *DevBankParser) Parse(data []byte) ([]domain.Entity, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(records) < 2 {
		return nil, nil
	}
	hdr := buildHeaderIndex(records[0])
	var entities []domain.Entity
	for _, rec := range records[1:] {
		name := hdr.get(rec, "Firm Name", "Entity Name", "Name",
			"name", "firm_name", "entity_name")
		if name == "" || len(name) < 3 {
			continue
		}
		name = strings.TrimSpace(name)
		entID := sanitizeBulkID(p.listID + "_" + name)
		id, err := domain.NewEntityID(entID)
		if err != nil {
			continue
		}
		normalized := NormalizeName(name)
		n, _ := domain.NewName(normalized, "", "", "")
		typ := domain.EntityTypeCompany
		if looksLikePerson(name) {
			typ = domain.EntityTypeIndividual
		}
		ent, err := domain.NewEntity(id, typ, []domain.Name{n})
		if err != nil {
			continue
		}
		ent.ListID = p.listID
		country := hdr.get(rec, "Country", "Nationality", "country")
		if country != "" {
			setMeta(&ent, "country", country)
		}
		setDevBankFields(&ent, rec, hdr, p.listID, typ)
		entities = append(entities, ent)
	}
	return entities, nil
}
