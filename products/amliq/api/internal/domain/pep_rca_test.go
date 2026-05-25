package domain

import "testing"

func TestNewRCARelation(t *testing.T) {
	tests := []struct {
		name      string
		pepID     string
		relatedID string
		relType   RCAType
		wantErr   bool
	}{
		{"valid spouse", "ent_1", "ent_2", RCASpouse, false},
		{"valid child", "ent_1", "ent_3", RCAChild, false},
		{"valid associate", "ent_1", "ent_4", RCAAssociate, false},
		{"empty pep id", "", "ent_2", RCASpouse, true},
		{"empty related id", "ent_1", "", RCAChild, true},
		{"both empty", "", "", RCAParent, true},
		{"advisor", "ent_1", "ent_5", RCAAdvisor, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rel, err := NewRCARelation(tt.pepID, tt.relatedID, tt.relType, "desc")
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if rel.RelationType != tt.relType {
				t.Errorf("type = %s, want %s", rel.RelationType, tt.relType)
			}
		})
	}
}

func TestNewPEPProfile(t *testing.T) {
	tests := []struct {
		name     string
		entityID string
		tier     PEPTier
		position string
		country  string
	}{
		{"head of state", "ent_1", PEPTier1, "President", "US"},
		{"senior official", "ent_2", PEPTier2, "Minister", "GB"},
		{"regional", "ent_3", PEPTier3, "Governor", "DE"},
		{"local", "ent_4", PEPTier4, "Mayor", "FR"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewPEPProfile(tt.entityID, tt.tier, tt.position, tt.country)
			if p.EntityID != tt.entityID {
				t.Errorf("EntityID = %s, want %s", p.EntityID, tt.entityID)
			}
			if p.Tier != tt.tier {
				t.Errorf("Tier = %v, want %v", p.Tier, tt.tier)
			}
			if !p.IsActive {
				t.Error("expected IsActive=true")
			}
		})
	}
}
