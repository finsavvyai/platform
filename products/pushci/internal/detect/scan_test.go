package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestScanCases(t *testing.T) {
	tests := []struct {
		name   string
		setup  func(dir string)
		stacks []Stack
	}{
		{
			name:   "empty directory",
			setup:  func(dir string) {},
			stacks: nil,
		},
		{
			name: "nested Node project",
			setup: func(dir string) {
				web := filepath.Join(dir, "web")
				os.MkdirAll(web, 0o755)
				os.WriteFile(filepath.Join(web, "package.json"), []byte(`{}`), 0o644)
			},
			stacks: []Stack{Node},
		},
		{
			name: "Docker project",
			setup: func(dir string) {
				os.WriteFile(filepath.Join(dir, "Dockerfile"), []byte("FROM alpine"), 0o644)
			},
			stacks: []Stack{Docker},
		},
		{
			name: "skips node_modules",
			setup: func(dir string) {
				nm := filepath.Join(dir, "node_modules", "pkg")
				os.MkdirAll(nm, 0o755)
				os.WriteFile(filepath.Join(nm, "package.json"), []byte(`{}`), 0o644)
				// real project at root
				os.WriteFile(filepath.Join(dir, "Dockerfile"), []byte("FROM alpine"), 0o644)
			},
			stacks: []Stack{Docker},
		},
		{
			name: "skips vendor directory",
			setup: func(dir string) {
				v := filepath.Join(dir, "vendor", "lib")
				os.MkdirAll(v, 0o755)
				os.WriteFile(filepath.Join(v, "Gemfile"), []byte(""), 0o644)
				os.WriteFile(filepath.Join(dir, "Dockerfile"), []byte("FROM alpine"), 0o644)
			},
			stacks: []Stack{Docker},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			tt.setup(dir)
			projects := Scan(dir)
			got := make([]Stack, len(projects))
			for i, p := range projects {
				got[i] = p.Stack
			}
			if len(got) != len(tt.stacks) {
				t.Fatalf("Scan() got %v, want %v", got, tt.stacks)
			}
			for i := range tt.stacks {
				if got[i] != tt.stacks[i] {
					t.Errorf("stack[%d] = %q, want %q", i, got[i], tt.stacks[i])
				}
			}
		})
	}
}
