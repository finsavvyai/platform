package ingestion

import (
	"bytes"
	"encoding/csv"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// UKOFSIParser parses the UK OFSI/FCDO Consolidated List CSV.
type UKOFSIParser struct{}

func NewUKOFSIParser() *UKOFSIParser {
	return &UKOFSIParser{}
}

func (p *UKOFSIParser) Parse(data []byte) ([]domain.Entity, error) {
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

	// FCDO CSV starts with "Last Updated,<date>" metadata line before
	// the real header. Match on "Name 6" anchor AND multi-column shape
	// to avoid collision with the 2-column metadata preamble.
	headerRow := -1
	for i, rec := range records {
		if len(rec) >= 10 && strings.TrimSpace(rec[0]) == "Name 6" {
			headerRow = i
			break
		}
	}
	if headerRow < 0 {
		return nil, nil
	}
	if headerRow+1 >= len(records) {
		return nil, nil
	}

	hdr := buildHeaderIndex(records[headerRow])
	idx := make(map[string]int)
	var entities []domain.Entity
	for _, rec := range records[headerRow+1:] {
		ent, ok := parseUKOFSIRecord(rec, hdr)
		if !ok {
			continue
		}
		key := ent.ID.String()
		if pos, exists := idx[key]; exists {
			mergeUKOFSIAlias(&entities[pos], ent)
			continue
		}
		idx[key] = len(entities)
		entities = append(entities, ent)
	}
	return entities, nil
}

// parseUKOFSIRecord and mergeUKOFSIAlias live in sibling files
// (uk_ofsi_record.go, uk_ofsi_merge.go) to keep this file under the
// 100-line per-file project rule.
