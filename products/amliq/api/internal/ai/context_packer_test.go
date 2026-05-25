package ai

import "testing"

func TestPackEntityContext(t *testing.T) {
	tests := []struct {
		name     string
		entity   map[string]interface{}
		matched  []string
		wantKeys []string
		dropKeys []string
	}{
		{
			name: "keeps matched and always-keep fields",
			entity: map[string]interface{}{
				"name": "John", "dob": "1980-01-01",
				"address": "123 Main St", "id": "abc-123",
			},
			matched:  []string{"address"},
			wantKeys: []string{"name", "dob", "address"},
			dropKeys: []string{"id"},
		},
		{
			name: "strips internal fields",
			entity: map[string]interface{}{
				"name": "Jane", "created_at": "2024-01-01",
				"updated_at": "2024-06-01", "_version": 3,
			},
			matched:  nil,
			wantKeys: []string{"name"},
			dropKeys: []string{"created_at", "updated_at", "_version"},
		},
		{
			name:     "empty entity returns empty",
			entity:   map[string]interface{}{},
			matched:  []string{"address"},
			wantKeys: nil,
			dropKeys: nil,
		},
		{
			name: "nationality always kept",
			entity: map[string]interface{}{
				"nationality": "US", "metadata": "big blob",
				"list_source": "ofac_sdn",
			},
			matched:  nil,
			wantKeys: []string{"nationality", "list_source"},
			dropKeys: []string{"metadata"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := PackEntityContext(tt.entity, tt.matched)
			for _, k := range tt.wantKeys {
				if _, ok := got[k]; !ok {
					t.Errorf("missing expected key %q", k)
				}
			}
			for _, k := range tt.dropKeys {
				if _, ok := got[k]; ok {
					t.Errorf("should have dropped key %q", k)
				}
			}
		})
	}
}

func TestEstimateTokens(t *testing.T) {
	tests := []struct {
		name string
		text string
		want int
	}{
		{"empty", "", 0},
		{"short", "hi", 1},
		{"normal", "hello world this is a test", 6},
		{"exact multiple", "1234567890123456", 4},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := EstimateTokens(tt.text)
			if got != tt.want {
				t.Errorf("EstimateTokens(%q) = %d, want %d",
					tt.text, got, tt.want)
			}
		})
	}
}
