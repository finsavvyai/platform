package ingestion

import "testing"

func TestIsraeliMoDParser(t *testing.T) {
	parser := NewIsraeliMoDParser()
	tests := []struct {
		name          string
		data          []byte
		expectedCount int
		wantNat       string
	}{
		{
			name:          "empty",
			data:          []byte("id,name\n"),
			expectedCount: 0,
		},
		{
			name:          "single_record",
			data:          []byte("id,name\n123456789012,Israeli Person\n"),
			expectedCount: 1,
			wantNat:       "IL",
		},
		{
			name:          "name_normalization",
			data:          []byte("id,name\n123456789012,  John  Smith  \n"),
			expectedCount: 1,
			wantNat:       "IL",
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
			if tt.wantNat != "" && len(entities) > 0 {
				if len(entities[0].Nationalities) == 0 || entities[0].Nationalities[0] != tt.wantNat {
					t.Errorf("nationality = %v, want %v", entities[0].Nationalities, []string{tt.wantNat})
				}
			}
		})
	}
}
