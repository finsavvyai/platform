package pipeline

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectsNewGoProject(t *testing.T) {
	tests := []struct {
		name      string
		yml       string
		files     map[string]string
		wantCount int
	}{
		{
			name: "new go project detected",
			yml:  "on: [push]\nchecks:\n  - build\n  - test\n",
			files: map[string]string{
				"go.mod": "module example.com/foo\ngo 1.22\n",
			},
			wantCount: 1,
		},
		{
			name: "existing stack no change",
			yml:  "on: [push]\nchecks:\n  - go\n",
			files: map[string]string{
				"go.mod": "module example.com/foo\ngo 1.22\n",
			},
			wantCount: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			os.WriteFile(filepath.Join(dir, "pushci.yml"), []byte(tt.yml), 0644)
			for name, content := range tt.files {
				p := filepath.Join(dir, name)
				os.MkdirAll(filepath.Dir(p), 0755)
				os.WriteFile(p, []byte(content), 0644)
			}
			u := NewUpdater()
			changes, err := u.Check(dir)
			if err != nil {
				t.Fatalf("Check: %v", err)
			}
			if len(changes) != tt.wantCount {
				t.Errorf("got %d changes, want %d: %+v", len(changes), tt.wantCount, changes)
			}
		})
	}
}

func TestDetectsNodeFrameworkChange(t *testing.T) {
	tests := []struct {
		name      string
		yml       string
		pkgJSON   string
		wantCount int
	}{
		{
			name:      "CRA to Next.js",
			yml:       "on: [push]\nchecks:\n  - build\n  - test\n",
			pkgJSON:   `{"dependencies":{"next":"14.0.0"}}`,
			wantCount: 1,
		},
		{
			name:      "node with new framework",
			yml:       "on: [push]\nchecks:\n  - node\n",
			pkgJSON:   `{"dependencies":{"react-scripts":"5.0.0"}}`,
			wantCount: 1,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			os.WriteFile(filepath.Join(dir, "pushci.yml"), []byte(tt.yml), 0644)
			os.WriteFile(filepath.Join(dir, "package.json"), []byte(tt.pkgJSON), 0644)
			if tt.pkgJSON != "" {
				os.WriteFile(filepath.Join(dir, "next.config.js"), []byte("{}"), 0644)
			}
			u := NewUpdater()
			changes, err := u.Check(dir)
			if err != nil {
				t.Fatalf("Check: %v", err)
			}
			if len(changes) < tt.wantCount {
				t.Errorf("got %d changes, want >= %d", len(changes), tt.wantCount)
			}
		})
	}
}
