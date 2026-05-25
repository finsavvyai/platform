package ingestion

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// OFACParser parses the OFAC SDN delimited file.
// Source: https://www.treasury.gov/ofac/downloads/sdn.del
// Note: OFAC uses @ as field separator, not comma.
type OFACParser struct{}

func NewOFACParser() *OFACParser {
	return &OFACParser{}
}

func (op *OFACParser) Parse(data []byte) ([]domain.Entity, error) {
	// Detect delimiter: if data contains pipes, use pipe
	delimiter := detectOFACDelimiter(data)
	reader := csv.NewReader(bytes.NewReader(data))
	reader.Comma = delimiter
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	var entities []domain.Entity
	for _, rec := range records {
		ent, ok := parseOFACRecord(rec)
		if ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

func parseOFACRecord(rec []string) (domain.Entity, bool) {
	if len(rec) < 3 {
		return domain.Entity{}, false
	}

	rawID := strings.TrimSpace(rec[0])
	fullName := strings.TrimSpace(rec[1])
	entType := strings.TrimSpace(rec[2])

	if fullName == "" || rawID == "" {
		return domain.Entity{}, false
	}
	// Require at least 2 name parts for individuals
	normalized := NormalizeName(fullName)
	if isOneWord(normalized) {
		return domain.Entity{}, false
	}

	padded := fmt.Sprintf("%012s", rawID)
	padded = strings.ReplaceAll(padded, " ", "0")
	id, err := domain.NewEntityID("ent_" + padded)
	if err != nil {
		return domain.Entity{}, false
	}

	typ := mapOFACEntityType(entType)

	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, typ, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "ofac-sdn"

	// Extract program (col 3) and DOB (col 11) if available
	if len(rec) > 3 {
		setMeta(&ent, "program", strings.TrimSpace(rec[3]))
	}
	if len(rec) > 13 {
		rawDOB := strings.TrimSpace(rec[13])
		setMeta(&ent, "dob", rawDOB)
		parseDOB(&ent, rawDOB)
	}

	setOFACEnrichFields(&ent, rec)

	if typ == domain.EntityTypeVessel {
		parseVesselFields(rec, &ent)
	}
	return ent, true
}
