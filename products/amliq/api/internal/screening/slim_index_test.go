package screening

import "testing"

func TestSlimIndexAddAndSearch(t *testing.T) {
	si := NewSlimIndex()
	si.Add("ent_001", "Vladimir Putin")
	si.Add("ent_002", "Mohammad Hassan")
	si.Add("ent_003", "John Smith")
	si.Add("ent_004", "Kim Jong Un")

	tests := []struct {
		name    string
		query   string
		wantIDs []string
	}{
		{
			name:    "exact normalized",
			query:   "Vladimir Putin",
			wantIDs: []string{"ent_001"},
		},
		{
			name:    "phonetic match",
			query:   "Vladimer Pootin",
			wantIDs: []string{"ent_001"},
		},
		{
			name:    "reversed order",
			query:   "Putin Vladimir",
			wantIDs: []string{"ent_001"},
		},
		{
			name:    "partial name",
			query:   "Putin",
			wantIDs: []string{"ent_001"},
		},
		{
			name:    "arabic name",
			query:   "Mohammad Hassan",
			wantIDs: []string{"ent_002"},
		},
		{
			name:    "common name",
			query:   "John Smith",
			wantIDs: []string{"ent_003"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results := si.Search(tt.query, 10)
			if len(results) == 0 {
				t.Fatalf("no results for query %q", tt.query)
			}
			found := false
			for _, r := range results {
				for _, wantID := range tt.wantIDs {
					if r.EntityID == wantID {
						found = true
					}
				}
			}
			if !found {
				t.Errorf("wanted %v in results, got %v",
					tt.wantIDs, results)
			}
		})
	}
}

func TestSlimIndexEntityCount(t *testing.T) {
	si := NewSlimIndex()
	if si.EntityCount() != 0 {
		t.Error("expected 0 entities")
	}
	si.Add("ent_001", "Test Entity")
	if si.EntityCount() != 1 {
		t.Error("expected 1 entity")
	}
}

func TestSlimReload(t *testing.T) {
	si := NewSlimIndex()
	si.Add("ent_001", "Vladimir Putin")

	// Add via thread-safe method
	si.SlimAdd("ent_002", "Mohammad Hassan")
	if si.EntityCount() != 2 {
		t.Errorf("expected 2 entities, got %d", si.EntityCount())
	}

	// Remove
	si.SlimRemove("ent_001")
	if si.EntityCount() != 1 {
		t.Errorf("expected 1 entity after remove, got %d", si.EntityCount())
	}
}

func BenchmarkSlimIndexSearch(b *testing.B) {
	si := NewSlimIndex()
	// Load 10K entities for benchmark
	for i := 0; i < 10000; i++ {
		id := "ent_" + slimPadInt(i)
		si.Add(id, "Entity Name "+slimPadInt(i))
	}
	si.Add("ent_target", "Vladimir Putin")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		si.Search("Vladimir Putin", 50)
	}
}

func slimPadInt(n int) string {
	s := "000000000000"
	ns := ""
	for n > 0 {
		ns = string(rune('0'+n%10)) + ns
		n /= 10
	}
	if ns == "" {
		ns = "0"
	}
	return s[:12-len(ns)] + ns
}
