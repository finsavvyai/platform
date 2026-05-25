package domain

import "testing"

func TestNewEntityID(t *testing.T) {
	tests := []struct {
		name      string
		id        string
		shouldErr bool
	}{
		{
			name:      "valid_id",
			id:        "ent_000000000001",
			shouldErr: false,
		},
		{
			name:      "wikidata_id",
			id:        "Q43723",
			shouldErr: false,
		},
		{
			name:      "pep_id",
			id:        "pep_netanyahu",
			shouldErr: false,
		},
		{
			name:      "too_short",
			id:        "x",
			shouldErr: true,
		},
		{
			name:      "empty_id",
			id:        "",
			shouldErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewEntityID(tt.id)
			if (err != nil) != tt.shouldErr {
				t.Errorf("NewEntityID() error = %v, shouldErr = %v", err, tt.shouldErr)
			}
		})
	}
}

func TestEntityIDString(t *testing.T) {
	id, _ := NewEntityID("ent_000000000001")
	if id.String() != "ent_000000000001" {
		t.Errorf("String() = %s, want ent_000000000001", id.String())
	}
}

func TestEntityIDIsZero(t *testing.T) {
	empty := EntityID{}
	if !empty.IsZero() {
		t.Errorf("IsZero() on empty EntityID should be true")
	}

	id, _ := NewEntityID("ent_000000000001")
	if id.IsZero() {
		t.Errorf("IsZero() on valid EntityID should be false")
	}
}
