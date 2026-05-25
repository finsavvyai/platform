package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadEdgeCases(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(dir string) string
		wantErr bool
	}{
		{
			name: "non-existent file",
			setup: func(dir string) string {
				return filepath.Join(dir, "nope.yml")
			},
			wantErr: true,
		},
		{
			name: "invalid YAML",
			setup: func(dir string) string {
				p := filepath.Join(dir, "bad.yml")
				os.WriteFile(p, []byte(":\n\t- :\n\t\t[[["), 0o644)
				return p
			},
			wantErr: true,
		},
		{
			name: "empty file",
			setup: func(dir string) string {
				p := filepath.Join(dir, "empty.yml")
				os.WriteFile(p, []byte(""), 0o644)
				return p
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			path := tt.setup(dir)
			_, err := Load(path)
			if (err != nil) != tt.wantErr {
				t.Errorf("Load() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckUnmarshalYAML(t *testing.T) {
	tests := []struct {
		name      string
		yaml      string
		wantName  string
		wantLimit int
	}{
		{
			name:     "scalar string value",
			yaml:     "checks:\n  - build\n",
			wantName: "build",
		},
		{
			name:      "object with name and line-limit",
			yaml:      "checks:\n  - name: lines\n    line-limit: 80\n",
			wantName:  "lines",
			wantLimit: 80,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			p := filepath.Join(dir, "pushci.yml")
			os.WriteFile(p, []byte(tt.yaml), 0o644)
			cfg, err := Load(p)
			if err != nil {
				t.Fatalf("Load() error = %v", err)
			}
			if cfg.Checks[0].Name != tt.wantName {
				t.Errorf("Name = %q, want %q", cfg.Checks[0].Name, tt.wantName)
			}
			if cfg.Checks[0].Limit != tt.wantLimit {
				t.Errorf("Limit = %d, want %d", cfg.Checks[0].Limit, tt.wantLimit)
			}
		})
	}
}
