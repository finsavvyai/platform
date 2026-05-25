package notification

import (
	"strings"
	"testing"
)

func TestFormatAlertEmail(t *testing.T) {
	html := FormatAlertEmail("John Smith", "MATCH", 0.87)

	tests := []struct {
		name    string
		contain string
	}{
		{"entity_name", "John Smith"},
		{"status", "MATCH"},
		{"confidence", "87%"},
		{"dashboard_link", "app.amliq.io"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.Contains(html, tt.contain) {
				t.Errorf("email missing %q", tt.contain)
			}
		})
	}
}
