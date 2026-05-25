package domain

import (
	"fmt"
	"time"
)

type Entity struct {
	ID              EntityID
	Type            EntityType
	Names           []Name
	DOB             *time.Time
	Nationalities   []string
	Identifiers     []Identifier
	Addresses       []string
	ListID          string
	Metadata        map[string]interface{}
	CreatedAt       time.Time
	UpdatedAt       time.Time
	// First-class enrichment fields (migration 067). Nullable — parsers
	// populate as data is available; existing rows stay zero.
	PEPTier         PEPTier
	DesignationDate *time.Time
	DelistingDate   *time.Time
	PositionTitle   string
	PlaceOfBirth    string
	Gender          string
}

func NewEntity(
	id EntityID,
	typ EntityType,
	names []Name,
) (Entity, error) {
	if id.IsZero() {
		return Entity{}, fmt.Errorf("entity id required")
	}
	if len(names) == 0 {
		return Entity{}, fmt.Errorf("at least one name required")
	}
	now := time.Now().UTC()
	return Entity{
		ID:          id,
		Type:        typ,
		Names:       names,
		Identifiers: []Identifier{},
		Addresses:   []string{},
		Metadata:    make(map[string]interface{}),
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (e Entity) PrimaryName() Name {
	if len(e.Names) > 0 {
		return e.Names[0]
	}
	return Name{}
}

func (e Entity) String() string {
	return fmt.Sprintf("%s (%s)", e.PrimaryName().String(), e.Type.String())
}
