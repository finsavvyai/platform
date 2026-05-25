package ingestion

import (
	"bytes"
	"encoding/csv"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// OpenSanctionsParser parses OpenSanctions CSV format with dynamic
// header resolution, schema-based entity typing, and extended fields.
type OpenSanctionsParser struct {
	// nameColumn overrides the default "name" column.
	// Used by alias variant to read from "aliases" instead.
	nameColumn string
}

func NewOpenSanctionsParser() *OpenSanctionsParser {
	return &OpenSanctionsParser{nameColumn: "name"}
}

// NewOpenSanctionsAliasParser uses the aliases column as primary name.
func NewOpenSanctionsAliasParser() *OpenSanctionsParser {
	return &OpenSanctionsParser{nameColumn: "aliases"}
}

func (p *OpenSanctionsParser) Parse(
	data []byte,
) ([]domain.Entity, error) {
	reader := csv.NewReader(bytes.NewReader(data))
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
		ent, ok := p.parseRecord(rec, hdr)
		if ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

func (p *OpenSanctionsParser) parseRecord(
	rec []string, hdr headerIndex,
) (domain.Entity, bool) {
	listID := hdr.get(rec, "id")
	if listID == "" || len(listID) < 3 {
		return domain.Entity{}, false
	}

	schema := hdr.get(rec, "schema")
	typ := domain.EntityTypeIndividual
	if schema != "" && schema != "Person" {
		typ = domain.EntityTypeCompany
	}

	fullName := p.resolveName(rec, hdr, typ)
	if fullName == "" {
		return domain.Entity{}, false
	}

	normalized := NormalizeName(fullName)
	if isOneWord(normalized) && typ == domain.EntityTypeIndividual {
		return domain.Entity{}, false
	}

	id, _ := domain.NewEntityID(listID)
	first := firstOfCSV(hdr.get(rec, "first_name", "firstName", "given_name"))
	family := firstOfCSV(hdr.get(rec, "last_name", "lastName", "family_name", "surname"))
	script := firstOfCSV(hdr.get(rec, "original_script", "name_original", "nameOriginal"))
	name, _ := domain.NewName(normalized, first, family, script)
	ent, err := domain.NewEntity(id, typ, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}

	ent.ListID = "opensanctions"
	setExtendedFields(&ent, rec, hdr)
	return ent, true
}

// firstOfCSV returns the first semicolon-separated value in an
// OpenSanctions bulk CSV cell (the feed uses ";" for multi-value).
func firstOfCSV(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if i := strings.Index(raw, ";"); i > 0 {
		return strings.TrimSpace(raw[:i])
	}
	return raw
}
