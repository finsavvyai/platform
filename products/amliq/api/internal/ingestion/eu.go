package ingestion

import (
	"bytes"
	"encoding/csv"
	"io"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// EUParser parses the EU Financial Sanctions CSV (semicolon-delimited).
// Handles multi-row aggregation by Entity_logical_id — multiple rows
// describe different aspects (names, addresses, IDs) of one entity.
type EUParser struct{}

func NewEUParser() *EUParser {
	return &EUParser{}
}

func (ep *EUParser) Parse(data []byte) ([]domain.Entity, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	reader.Comma = ';'
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
	aggregated := aggregateEUEntities(records[1:], hdr)

	var entities []domain.Entity
	for _, agg := range aggregated {
		ent, ok := agg.toEntity()
		if ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

// ParseStream implements StreamParser for the EU FSF CSV. Multi-row
// entries are aggregated in memory by Entity_logical_id, then emitted
// once all rows are consumed. Peak RAM is bounded by the EU entity
// count (~12k entities) rather than the raw CSV size.
func (ep *EUParser) ParseStream(r io.Reader, emit EntityEmitter) error {
	reader := csv.NewReader(r)
	reader.Comma = ';'
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true

	headerRow, err := reader.Read()
	if err != nil {
		return nil
	}
	hdr := buildHeaderIndex(headerRow)

	byID := make(map[string]*euEntityAgg)
	for {
		row, err := reader.Read()
		if err != nil {
			break
		}
		eid := strings.TrimSpace(hdr.get(row, "Entity_logical_id"))
		if eid == "" {
			continue
		}
		agg, ok := byID[eid]
		if !ok {
			agg = &euEntityAgg{entityID: eid}
			byID[eid] = agg
		}
		agg.addRow(row, hdr)
	}

	for _, agg := range byID {
		if ent, ok := agg.toEntity(); ok {
			if err := emit(ent); err != nil {
				return err
			}
		}
	}
	return nil
}

// aggregateEUEntities groups rows by Entity_logical_id.
func aggregateEUEntities(
	rows [][]string, hdr headerIndex,
) map[string]*euEntityAgg {
	byID := make(map[string]*euEntityAgg)
	for _, row := range rows {
		eid := strings.TrimSpace(hdr.get(row, "Entity_logical_id"))
		if eid == "" {
			continue
		}
		agg, ok := byID[eid]
		if !ok {
			agg = &euEntityAgg{entityID: eid}
			byID[eid] = agg
		}
		agg.addRow(row, hdr)
	}
	return byID
}
