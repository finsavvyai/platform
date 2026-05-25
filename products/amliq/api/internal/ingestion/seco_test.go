package ingestion

import "testing"

func TestSECOParser(t *testing.T) {
	parser := NewSECOParser()
	tests := []struct {
		name          string
		data          []byte
		expectedCount int
		wantDataset   string
	}{
		{
			name:          "empty",
			data:          []byte("id,name\n"),
			expectedCount: 0,
		},
		{
			name:          "single_record",
			data:          []byte("id,name\n123456789012,Swiss Person\n"),
			expectedCount: 1,
			wantDataset:   "ch_seco",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entities, err := parser.Parse(tt.data)
			if err != nil {
				t.Fatalf("Parse() error = %v", err)
			}
			if len(entities) != tt.expectedCount {
				t.Errorf("Parse() returned %d entities, want %d",
					len(entities), tt.expectedCount)
			}
			if tt.expectedCount > 0 && tt.wantDataset != "" {
				if v := entities[0].Metadata["dataset"]; v != tt.wantDataset {
					t.Errorf("dataset = %v, want %v", v, tt.wantDataset)
				}
			}
		})
	}
}
