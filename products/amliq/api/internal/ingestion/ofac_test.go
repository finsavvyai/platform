package ingestion

import "testing"

func TestOFACParser(t *testing.T) {
	parser := NewOFACParser()
	tests := []struct {
		name          string
		data          []byte
		expectedCount int
		checkMeta     string
	}{
		{
			name:          "empty",
			data:          []byte(""),
			expectedCount: 0,
		},
		{
			name:          "single_individual",
			data:          []byte("123456789012|John Smith|individual|SDGT\n"),
			expectedCount: 1,
		},
		{
			name:          "with_dob_and_remarks",
			data:          []byte("123456789012|John Smith|individual|SDGT||||||||||1980-01-01|Passport AB123; POB London; a.k.a. Johnny\n"),
			expectedCount: 1,
			checkMeta:     "dob",
		},
		{
			name:          "single_company",
			data:          []byte("123456789012|Acme Corp|company|SDGT\n"),
			expectedCount: 1,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entities, err := parser.Parse(tt.data)
			if err != nil {
				t.Fatalf("Parse() error = %v", err)
			}
			if len(entities) != tt.expectedCount {
				t.Errorf("Parse() returned %d entities, want %d", len(entities), tt.expectedCount)
			}
			if tt.checkMeta != "" && len(entities) > 0 {
				if _, ok := entities[0].Metadata[tt.checkMeta]; !ok {
					t.Errorf("expected metadata key %q not found", tt.checkMeta)
				}
			}
		})
	}
}
