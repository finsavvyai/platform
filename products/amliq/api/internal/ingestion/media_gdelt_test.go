package ingestion

import (
	"strings"
	"testing"
)

func TestGDELTParser(t *testing.T) {
	// Simulated GDELT GKG TSV line (tab-separated, 15+ fields)
	line := strings.Join([]string{
		"20260403",            // 0: date
		"1",                   // 1: ID
		"Russia sanctions",    // 2: title
		"SANCTIONS;CRIME",     // 3: themes
		"https://reuters.com/article/sanctions-russia", // 4: URL
		"",                    // 5: counts
		"Vladimir Putin",      // 6: persons
		"Kremlin",             // 7: orgs
		"",                    // 8: locations
		"-5.2",                // 9: tone
		"RS",                  // 10: country
		"", "", "", "",        // 11-14: padding
	}, "\t")

	parser := NewGDELTParser()
	articles := parser.Parse([]byte(line))

	if len(articles) != 1 {
		t.Fatalf("expected 1 article, got %d", len(articles))
	}

	tests := []struct {
		name  string
		check func() bool
		msg   string
	}{
		{"url", func() bool { return articles[0].URL == "https://reuters.com/article/sanctions-russia" }, "wrong URL"},
		{"source", func() bool { return articles[0].Source == "reuters.com" }, "wrong source"},
		{"persons", func() bool { return len(articles[0].Persons) == 1 && articles[0].Persons[0] == "Vladimir Putin" }, "wrong persons"},
		{"country", func() bool { return articles[0].Country == "RS" }, "wrong country"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !tt.check() {
				t.Error(tt.msg)
			}
		})
	}
}

func TestGDELTFilterNonAML(t *testing.T) {
	line := strings.Join([]string{
		"20260403", "1", "Sports news", "SPORTS;ENTERTAINMENT",
		"https://espn.com/article", "", "", "", "", "2.0", "US",
		"", "", "", "",
	}, "\t")

	parser := NewGDELTParser()
	articles := parser.Parse([]byte(line))
	if len(articles) != 0 {
		t.Error("non-AML article should be filtered out")
	}
}
