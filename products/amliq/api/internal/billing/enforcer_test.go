package billing

import (
	"testing"
)

func TestCurrentPeriod(t *testing.T) {
	tests := []struct {
		name     string
		validate func(string) bool
	}{
		{
			"format is YYYY-MM",
			func(s string) bool {
				return len(s) == 7 && s[4] == '-'
			},
		},
		{
			"non-empty",
			func(s string) bool { return s != "" },
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CurrentPeriod()
			if !tt.validate(result) {
				t.Errorf("CurrentPeriod() = %q, failed validation", result)
			}
		})
	}
}
