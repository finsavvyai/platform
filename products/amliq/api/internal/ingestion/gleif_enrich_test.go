package ingestion

import "testing"

func TestGLEIFParserEnrichesAddresses(t *testing.T) {
	tests := []struct {
		name       string
		data       []byte
		wantAddrs  int
		wantLEI    bool
		wantLegal  string
	}{
		{
			name: "hq + legal addresses both populated",
			data: []byte(`{"data":[{"id":"5493001KJTIIGC8K1R12","attributes":{"entity":{` +
				`"legalName":{"name":"Apple Inc"},"jurisdiction":"US","legalForm":{"id":"XTIQ"},` +
				`"headquartersAddress":{"addressLines":["One Apple Park Way"],"city":"Cupertino","region":"CA","country":"US","postalCode":"95014"},` +
				`"legalAddress":{"addressLines":["123 Legal St"],"city":"Wilmington","country":"US"}}}}]}`),
			wantAddrs: 2, wantLEI: true, wantLegal: "XTIQ",
		},
		{
			name: "identical hq + legal collapse to one address",
			data: []byte(`{"data":[{"id":"LEI123","attributes":{"entity":{` +
				`"legalName":{"name":"Test Corp Ltd"},"jurisdiction":"GB",` +
				`"headquartersAddress":{"addressLines":["1 Test St"],"city":"London","country":"GB"},` +
				`"legalAddress":{"addressLines":["1 Test St"],"city":"London","country":"GB"}}}}]}`),
			wantAddrs: 1, wantLEI: true,
		},
		{
			name: "no addresses emitted when block empty",
			data: []byte(`{"data":[{"id":"LEI456","attributes":{"entity":{` +
				`"legalName":{"name":"NoAddr Corp"},"jurisdiction":"DE"}}}]}`),
			wantAddrs: 0, wantLEI: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ents, err := NewGLEIFParser().Parse(tt.data)
			if err != nil {
				t.Fatalf("parse: %v", err)
			}
			if len(ents) != 1 {
				t.Fatalf("want 1 entity, got %d", len(ents))
			}
			e := ents[0]
			if got := len(e.Addresses); got != tt.wantAddrs {
				t.Errorf("addresses = %d, want %d (%v)",
					got, tt.wantAddrs, e.Addresses)
			}
			if tt.wantLEI && len(e.Identifiers) == 0 {
				t.Errorf("expected LEI identifier, got none")
			}
			if tt.wantLegal != "" && e.Metadata["legal_form"] != tt.wantLegal {
				t.Errorf("legal_form = %q, want %q",
					e.Metadata["legal_form"], tt.wantLegal)
			}
		})
	}
}
