package ingestion

import (
	"testing"
)

func TestGenericCSVParser(t *testing.T) {
	csv := "ID,Name,Type\n001234567890,John Smith,Individual\n009876543210,Acme Corp,Entity\n"
	parser := NewGenericCSVParser(CSVListConfig{
		ListID:    "test_list",
		Delimiter: ',',
		FieldMap:  map[string]string{"id": "ID", "name": "Name", "type": "Type"},
	})
	entities, err := parser.Parse([]byte(csv))
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}

	tests := []struct {
		name  string
		check func() bool
	}{
		{"count", func() bool { return len(entities) == 2 }},
		{"list_id", func() bool { return entities[0].ListID == "test_list" }},
		{"name", func() bool { return entities[0].Names[0].Full != "" }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.check() {
				t.Error("check failed")
			}
		})
	}
}

func TestGenericCSVSkipSingleWord(t *testing.T) {
	csv := "ID,Name\n001234567890,Madonna\n"
	parser := NewGenericCSVParser(CSVListConfig{
		ListID:   "test",
		FieldMap: map[string]string{"id": "ID", "name": "Name"},
	})
	entities, _ := parser.Parse([]byte(csv))
	if len(entities) != 0 {
		t.Error("single-word name should be skipped")
	}
}
