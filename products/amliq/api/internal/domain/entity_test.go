package domain

import "testing"

func TestNewEntity(t *testing.T) {
	id, _ := NewEntityID("ent_000000000001")
	name, _ := NewName("John Smith", "John", "Smith", "")

	tests := []struct {
		name      string
		id        EntityID
		typ       EntityType
		names     []Name
		shouldErr bool
	}{
		{
			name:      "valid_individual",
			id:        id,
			typ:       EntityTypeIndividual,
			names:     []Name{name},
			shouldErr: false,
		},
		{
			name:      "no_names",
			id:        id,
			typ:       EntityTypeIndividual,
			names:     []Name{},
			shouldErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewEntity(tt.id, tt.typ, tt.names)
			if (err != nil) != tt.shouldErr {
				t.Errorf("NewEntity() error = %v, shouldErr = %v", err, tt.shouldErr)
			}
		})
	}
}

func TestEntityPrimaryName(t *testing.T) {
	id, _ := NewEntityID("ent_000000000001")
	name1, _ := NewName("John Smith", "John", "Smith", "")
	name2, _ := NewName("Jane Smith", "Jane", "Smith", "")

	entity, _ := NewEntity(id, EntityTypeIndividual, []Name{name1, name2})
	primary := entity.PrimaryName()
	if primary.Full != "John Smith" {
		t.Errorf("PrimaryName() = %s, want John Smith", primary.Full)
	}
}
