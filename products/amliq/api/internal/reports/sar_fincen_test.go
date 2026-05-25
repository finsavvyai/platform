package reports

import (
	"strings"
	"testing"
)

func TestGenerateFinCENSAR(t *testing.T) {
	input := SARInput{
		InstitutionName: "Test Bank Inc",
		SubjectName:     "John Smith",
		SubjectDOB:      "1970-01-15",
		SubjectCountry:  "US",
		ActivityType:    "Money Laundering",
		Narrative:       "Subject flagged via AMLIQ screening with 95% confidence.",
		Amount:          "500000",
	}

	data, err := GenerateFinCENSAR(input)
	if err != nil {
		t.Fatalf("GenerateFinCENSAR error: %v", err)
	}

	xml := string(data)
	tests := []struct {
		name    string
		contain string
	}{
		{"root_element", "EFilingBatchXML"},
		{"institution", "Test Bank Inc"},
		{"subject_name", "John Smith"},
		{"narrative", "AMLIQ screening"},
		{"amount", "500000"},
		{"reference", "SAR-"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.Contains(xml, tt.contain) {
				t.Errorf("SAR XML missing %q", tt.contain)
			}
		})
	}
}
