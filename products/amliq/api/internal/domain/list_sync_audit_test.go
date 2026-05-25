package domain

import (
	"testing"
	"time"
)

func TestComputeCoverage(t *testing.T) {
	dob := time.Date(1970, 1, 15, 0, 0, 0, 0, time.UTC)
	name1, _ := NewName("John Doe", "", "", "")
	name2, _ := NewName("J. Doe", "", "", "")

	full := Entity{
		DOB:           &dob,
		Nationalities: []string{"US"},
		Addresses:     []string{"1 Main St"},
		Identifiers:   []Identifier{{Type: IDNationalID, Value: "123"}},
		Names:         []Name{name1, name2},
	}
	barebones := Entity{Names: []Name{name1}}

	tests := []struct {
		name             string
		entities         []Entity
		wantParsed       int
		wantDOB          int
		wantNat          int
		wantAddr         int
		wantIDs          int
		wantAliases      int
	}{
		{
			name:     "empty",
			entities: nil,
		},
		{
			name:        "fully enriched",
			entities:    []Entity{full, full},
			wantParsed:  2,
			wantDOB:     2,
			wantNat:     2,
			wantAddr:    2,
			wantIDs:     2,
			wantAliases: 2,
		},
		{
			name:        "mixed",
			entities:    []Entity{full, barebones, full},
			wantParsed:  3,
			wantDOB:     2,
			wantNat:     2,
			wantAddr:    2,
			wantIDs:     2,
			wantAliases: 2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			a := ListSyncAudit{}
			a.ComputeCoverage(tc.entities)
			if a.EntitiesParsed != tc.wantParsed {
				t.Errorf("parsed: got %d want %d",
					a.EntitiesParsed, tc.wantParsed)
			}
			if a.EntitiesWithDOB != tc.wantDOB {
				t.Errorf("dob: got %d want %d",
					a.EntitiesWithDOB, tc.wantDOB)
			}
			if a.EntitiesWithNat != tc.wantNat {
				t.Errorf("nat: got %d want %d",
					a.EntitiesWithNat, tc.wantNat)
			}
			if a.EntitiesWithAddr != tc.wantAddr {
				t.Errorf("addr: got %d want %d",
					a.EntitiesWithAddr, tc.wantAddr)
			}
			if a.EntitiesWithIDs != tc.wantIDs {
				t.Errorf("ids: got %d want %d",
					a.EntitiesWithIDs, tc.wantIDs)
			}
			if a.EntitiesWithAliases != tc.wantAliases {
				t.Errorf("aliases: got %d want %d",
					a.EntitiesWithAliases, tc.wantAliases)
			}
		})
	}
}
