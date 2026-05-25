package reports

import (
	"strings"
	"testing"
)

func TestGenerateUKNCA(t *testing.T) {
	input := SARInput{
		InstitutionName: "UK Bank Ltd",
		SubjectName:     "Jane Doe",
		SubjectDOB:      "1985-03-20",
		SubjectCountry:  "GB",
		Narrative:       "Suspected money laundering via shell companies.",
	}

	data, err := GenerateUKNCA(input)
	if err != nil {
		t.Fatalf("GenerateUKNCA error: %v", err)
	}
	xml := string(data)

	tests := []struct {
		name    string
		contain string
	}{
		{"root", "SuspiciousActivityReport"},
		{"institution", "UK Bank Ltd"},
		{"subject", "Jane Doe"},
		{"country", "GB"},
		{"narrative", "shell companies"},
		{"reference", "NCA-"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.Contains(xml, tt.contain) {
				t.Errorf("UK NCA SAR missing %q", tt.contain)
			}
		})
	}
}
