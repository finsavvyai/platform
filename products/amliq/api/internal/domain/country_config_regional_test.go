package domain

import (
	"testing"
)

func TestSuggestedListsEuropeAdvanced(t *testing.T) {
	tests := []struct {
		country string
		minLen  int
	}{
		{"DE", 2},
		{"FR", 2},
		{"IT", 2},
		{"ES", 2},
	}
	for _, tt := range tests {
		lists := SuggestedLists(tt.country)
		if len(lists) < tt.minLen {
			t.Errorf("%s should have at least %d lists", tt.country, tt.minLen)
		}
	}
}

func TestSuggestedListsSync(t *testing.T) {
	lists := SuggestedLists("IL")
	for _, l := range lists {
		if !l.SyncEnabled {
			t.Errorf("List %s should have sync enabled", l.ListID)
		}
		if l.SyncSchedule == "" {
			t.Errorf("List %s should have sync schedule", l.ListID)
		}
		if l.Threshold <= 0 || l.Threshold > 100 {
			t.Errorf("List %s invalid threshold: %f", l.ListID, l.Threshold)
		}
	}
}

func TestSuggestedListsURLs(t *testing.T) {
	lists := SuggestedLists("IL")
	for _, l := range lists {
		if l.SourceURL == "" {
			t.Errorf("List %s missing source URL", l.ListID)
		}
	}
}
