package reports

import (
	"strings"
	"testing"
)

func TestGenerateGoAML(t *testing.T) {
	input := SARInput{
		InstitutionName: "EU Bank AG",
		SubjectName:     "Hans Muller",
		SubjectDOB:      "1975-07-10",
		SubjectCountry:  "DE",
		ActivityType:    "Money Laundering",
		Narrative:       "Cross-border suspicious transfers.",
		Amount:          "250000",
	}

	data, err := GenerateGoAML(input)
	if err != nil {
		t.Fatalf("GenerateGoAML error: %v", err)
	}
	xml := string(data)

	tests := []struct {
		name    string
		contain string
	}{
		{"root", "goAMLReport"},
		{"namespace", "unodc.org/goAML"},
		{"version", `version="4.0"`},
		{"institution", "EU Bank AG"},
		{"suspect", "Hans Muller"},
		{"amount", "250000"},
		{"reference", "GOAML-"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.Contains(xml, tt.contain) {
				t.Errorf("goAML report missing %q", tt.contain)
			}
		})
	}
}
