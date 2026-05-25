package ingestion

import (
	"bytes"
	"encoding/csv"

	"github.com/aegis-aml/aegis/internal/domain"
)

type CustomParser struct{}

func NewCustomParser() *CustomParser {
	return &CustomParser{}
}

func (cp *CustomParser) Parse(data []byte) ([]domain.Entity, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	var entities []domain.Entity
	for i, record := range records {
		if i == 0 {
			continue
		}
		if len(record) < 2 {
			continue
		}

		id, _ := domain.NewEntityID("ent_" + record[0][:12])
		name, _ := domain.NewName(record[1], "", "", "")
		ent, _ := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{name})
		ent.ListID = "custom"
		if len(record) > 2 {
			ent.Metadata["source"] = record[2]
		}
		entities = append(entities, ent)
	}

	return entities, nil
}
