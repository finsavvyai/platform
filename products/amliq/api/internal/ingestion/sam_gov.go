package ingestion

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SAMExclusionsURL is the US SAM.gov exclusions public extract.
const SAMExclusionsURL = "https://sam.gov/api/prod/fileextractservices/v2/downloadFile?fileName=SAM_Exclusions_Public_Extract_V2.CSV&fileType=ENTITY"

// SAMGovParser parses SAM.gov exclusion list CSV.
// Columns: Classification, Name, Prefix, First, Middle, Last, Suffix,
// Address, City, State/Province, Country, ...
type SAMGovParser struct{}

func NewSAMGovParser() *SAMGovParser { return &SAMGovParser{} }

func (p *SAMGovParser) Parse(data []byte) ([]domain.Entity, error) {
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
	for i, rec := range records[1:] {
		name := p.extractName(rec, hdr)
		if name == "" || len(name) < 3 || isOneWord(name) {
			continue
		}
		entID := sanitizeBulkID(
			"sam_" + strings.ReplaceAll(name, " ", "_") + fmt.Sprintf("_%d", i),
		)
		id, err := domain.NewEntityID(entID)
		if err != nil {
			continue
		}
		normalized := NormalizeName(name)
		first := strings.TrimSpace(hdr.get(rec, "First"))
		last := strings.TrimSpace(hdr.get(rec, "Last"))
		n, _ := domain.NewName(normalized, first, last, "")
		typ := domain.EntityTypeIndividual
		classification := hdr.get(rec, "Classification")
		if classification == "Firm" || classification == "Entity" {
			typ = domain.EntityTypeCompany
		}
		ent, err := domain.NewEntity(id, typ, []domain.Name{n})
		if err != nil {
			continue
		}
		ent.ListID = "us_sam_exclusions"
		country := hdr.get(rec, "Country")
		if country != "" {
			setMeta(&ent, "country", country)
		}
		setSAMGovFields(&ent, rec, hdr, typ)
		entities = append(entities, ent)
	}
	return entities, nil
}

func (p *SAMGovParser) extractName(rec []string, hdr headerIndex) string {
	// Try full Name column first
	name := hdr.get(rec, "Name")
	if name != "" {
		return strings.TrimSpace(name)
	}
	// Build from parts
	first := hdr.get(rec, "First")
	last := hdr.get(rec, "Last")
	if first != "" && last != "" {
		return strings.TrimSpace(first + " " + last)
	}
	if last != "" {
		return strings.TrimSpace(last)
	}
	return ""
}
