package ingestion

import "testing"

func TestCustomParser(t *testing.T) {
	parser := NewCustomParser()
	tests := []struct {
		name          string
		data          []byte
		expectedCount int
	}{
		{
			name:          "empty",
			data:          []byte("id,name,source\n"),
			expectedCount: 0,
		},
		{
			name:          "single_record",
			data:          []byte("id,name,source\n123456789012,Custom Person,internal\n"),
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
		})
	}
}
