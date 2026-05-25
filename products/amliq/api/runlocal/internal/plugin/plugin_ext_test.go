package plugin

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestLicenseCheckPlugin(t *testing.T) {
	tests := []struct {
		name   string
		file   string
		passed bool
	}{
		{"has LICENSE", "LICENSE", true},
		{"no license", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			if tt.file != "" {
				os.WriteFile(filepath.Join(dir, tt.file), []byte("MIT"), 0644)
			}
			p := &LicenseCheckPlugin{}
			res, err := p.Run(context.Background(), dir)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Passed != tt.passed {
				t.Errorf("Passed=%v, want %v", res.Passed, tt.passed)
			}
		})
	}
}
