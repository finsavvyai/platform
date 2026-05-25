package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestEveryPoliticianParser(t *testing.T) {
	data := `[
		{"id":"Q1","name":"Angela Merkel","role":"Chancellor of Germany","area":"DE","start_date":"2005-11-22","end_date":"2021-12-08"},
		{"id":"Q2","name":"Emmanuel Macron","role":"President of France","area":"FR","start_date":"2017-05-14","end_date":""},
		{"id":"Q3","name":"","role":"Unknown","area":"XX"}
	]`

	parser := NewEveryPoliticianParser()
	profiles := parser.Parse([]byte(data))

	if len(profiles) != 2 {
		t.Fatalf("expected 2 profiles, got %d", len(profiles))
	}

	tests := []struct {
		name   string
		check  func() bool
	}{
		{"merkel_tier", func() bool { return profiles[0].Tier == domain.PEPTier1 }},
		{"merkel_inactive", func() bool { return !profiles[0].IsActive }},
		{"macron_tier", func() bool { return profiles[1].Tier == domain.PEPTier1 }},
		{"macron_active", func() bool { return profiles[1].IsActive }},
		{"macron_country", func() bool { return profiles[1].Country == "FR" }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.check() {
				t.Error("check failed")
			}
		})
	}
}
