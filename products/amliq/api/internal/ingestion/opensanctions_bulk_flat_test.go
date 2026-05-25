package ingestion

import (
	"testing"
)

// TestBulkParser_SimpleCSVFlatCols verifies that the bulk parser
// populates the rich cols (Addresses, Identifiers, Names) from flat
// simple.csv columns, not just from a `properties` JSON blob.
func TestBulkParser_SimpleCSVFlatCols(t *testing.T) {
	hdr := "id,schema,name,aliases,birth_date,countries,addresses,identifiers,dataset\n"
	row := "Q1,Person,John Smith,Jon Smith;Johnny S,1970-01-01,US;UK,1 Main St;2 Elm Ave,P123;ID456,us_ofac_sdn\n"
	tests := []struct {
		name         string
		minAddrs     int
		minIDs       int
		minExtraName int
	}{{"simple_flat", 2, 2, 2}}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ents, err := NewOpenSanctionsBulkParser().
				Parse([]byte(hdr + row))
			if err != nil {
				t.Fatalf("Parse: %v", err)
			}
			if len(ents) == 0 {
				t.Fatalf("no entities parsed")
			}
			e := ents[0]
			if len(e.Addresses) < tc.minAddrs {
				t.Errorf("addresses=%d want>=%d (%v)",
					len(e.Addresses), tc.minAddrs, e.Addresses)
			}
			if len(e.Identifiers) < tc.minIDs {
				t.Errorf("identifiers=%d want>=%d", len(e.Identifiers), tc.minIDs)
			}
			if len(e.Names)-1 < tc.minExtraName {
				t.Errorf("extra names=%d want>=%d (names=%d)",
					len(e.Names)-1, tc.minExtraName, len(e.Names))
			}
		})
	}
}
