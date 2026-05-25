package pgx

import (
	"encoding/json"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// buildEntity turns the core 12 entity columns (everything except the
// rich JSONB fields) into a *domain.Entity. Rich fields — addresses,
// identifiers, alias tail of Names — are layered on afterwards by
// applyRichCols inside scanEntity / scanEntityFromRows.
func buildEntity(id, typ, fullName, givenName, familyName, origScript string,
	dob *time.Time, nationalities, metadata []byte, listID string,
	createdAt, updatedAt time.Time) (*domain.Entity, error) {

	entID, err := domain.NewEntityID(id)
	if err != nil {
		return nil, err
	}
	entityType, _ := domain.ParseEntityType(typ)
	name := domain.Name{
		Full:           fullName,
		Given:          givenName,
		Family:         familyName,
		OriginalScript: origScript,
	}

	var nats []string
	if len(nationalities) > 0 {
		json.Unmarshal(nationalities, &nats)
	}
	var meta map[string]interface{}
	if len(metadata) > 0 {
		json.Unmarshal(metadata, &meta)
	} else {
		meta = make(map[string]interface{})
	}

	entity, err := domain.NewEntity(entID, entityType, []domain.Name{name})
	if err != nil {
		return nil, err
	}
	entity.DOB = dob
	entity.Nationalities = nats
	entity.ListID = listID
	entity.Metadata = meta
	entity.CreatedAt = createdAt
	entity.UpdatedAt = updatedAt
	return &entity, nil
}
