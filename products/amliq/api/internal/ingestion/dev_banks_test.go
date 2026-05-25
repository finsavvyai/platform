package ingestion

import "testing"

func TestADBParserEnrichesNationalityAndAddress(t *testing.T) {
	csv := []byte("Firm Name,Country,Address,City,Sanction Date,Reason\n" +
		"Acme Ltd,Philippines,123 Main,Manila,2024-05-10,Fraud\n" +
		"Bob Smith,India,,Mumbai,2023-09-01,Corruption\n")
	ents, err := NewADBParser().Parse(csv)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(ents) != 2 {
		t.Fatalf("want 2 entities, got %d", len(ents))
	}

	tests := []struct {
		idx      int
		wantNat  string
		wantAddr bool
	}{
		{0, "Philippines", true},
		{1, "India", true}, // city-only still builds an address
	}
	for _, tt := range tests {
		e := ents[tt.idx]
		nats := e.Nationalities
		if len(nats) == 0 || nats[0] != tt.wantNat {
			t.Errorf("entity %d: nationalities = %v, want [%s]",
				tt.idx, nats, tt.wantNat)
		}
		if tt.wantAddr && len(e.Addresses) == 0 {
			t.Errorf("entity %d: expected non-empty Addresses", tt.idx)
		}
		if e.Metadata["listing_date"] == "" {
			t.Errorf("entity %d: listing_date missing", tt.idx)
		}
		if e.Metadata["remarks"] == "" {
			t.Errorf("entity %d: remarks missing", tt.idx)
		}
	}
}
