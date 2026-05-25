package ingestion

import (
	"bytes"
	"encoding/csv"

	"github.com/aegis-aml/aegis/internal/domain"
)

type IsraeliMoDParser struct{}

func NewIsraeliMoDParser() *IsraeliMoDParser {
	return &IsraeliMoDParser{}
}

func (imp *IsraeliMoDParser) Parse(data []byte) ([]domain.Entity, error) {
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
		normalized := NormalizeName(record[1])
		name, _ := domain.NewName(normalized, "", "", "")
		ent, _ := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{name})
		ent.ListID = "israeli_mod"
		ent.Nationalities = []string{"IL"}
		setIsraeliMoDFields(&ent, record)
		entities = append(entities, ent)
	}

	return entities, nil
}
