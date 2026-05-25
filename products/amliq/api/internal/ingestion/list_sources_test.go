package ingestion

import "testing"

func TestAllSourcesUniqueIDs(t *testing.T) {
	seen := make(map[string]bool)
	for _, src := range AllSources {
		if seen[src.ID] {
			t.Errorf("duplicate source ID: %s", src.ID)
		}
		seen[src.ID] = true
	}
}

func TestAllSourcesHaveParser(t *testing.T) {
	for _, src := range AllSources {
		if src.Parser == "" {
			t.Errorf("source %s has no parser type", src.ID)
		}
	}
}

func TestAllSourcesHaveName(t *testing.T) {
	for _, src := range AllSources {
		if src.Name == "" {
			t.Errorf("source %s has no name", src.ID)
		}
	}
}

func TestSourceCountMinimum(t *testing.T) {
	if count := SourceCount(); count < 20 {
		t.Errorf("source count = %d, want >= 20", count)
	}
}

func TestSourceByIDFound(t *testing.T) {
	tests := []struct {
		id   string
		want string
	}{
		{"us_ofac_sdn", "US OFAC SDN"},
		{"opensanctions_default", "OpenSanctions Combined"},
		{"opensanctions_peps", "OpenSanctions PEPs"},
		{"eu_fsf", "EU Financial Sanctions"},
	}
	for _, tc := range tests {
		src := SourceByID(tc.id)
		if src == nil {
			t.Errorf("SourceByID(%q) = nil", tc.id)
			continue
		}
		if src.Name != tc.want {
			t.Errorf("SourceByID(%q).Name = %q, want %q",
				tc.id, src.Name, tc.want)
		}
	}
}

func TestSourceByIDNotFound(t *testing.T) {
	if src := SourceByID("nonexistent"); src != nil {
		t.Error("expected nil for nonexistent source")
	}
}

func TestAllSourcesHaveID(t *testing.T) {
	for _, src := range AllSources {
		if src.ID == "" {
			t.Errorf("source with name %q has no ID", src.Name)
		}
	}
}
