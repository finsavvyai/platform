package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestScan(t *testing.T) {
	tests := []struct {
		name  string
		files []string
		want  []Stack
	}{
		{
			name:  "go project",
			files: []string{"go.mod"},
			want:  []Stack{Go},
		},
		{
			name:  "node project",
			files: []string{"package.json"},
			want:  []Stack{Node},
		},
		{
			name:  "multi stack",
			files: []string{"go.mod", "web/package.json"},
			want:  []Stack{Go, Node},
		},
		{
			name:  "python",
			files: []string{"requirements.txt"},
			want:  []Stack{Python},
		},
		{
			name:  "rust",
			files: []string{"Cargo.toml"},
			want:  []Stack{Rust},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			for _, f := range tt.files {
				p := filepath.Join(dir, f)
				os.MkdirAll(filepath.Dir(p), 0o755)
				os.WriteFile(p, []byte{}, 0o644)
			}
			got := Scan(dir)
			if len(got) < len(tt.want) {
				t.Fatalf("got %d projects, want %d", len(got), len(tt.want))
			}
			for i, w := range tt.want {
				if got[i].Stack != w {
					t.Errorf("project[%d].Stack = %s, want %s", i, got[i].Stack, w)
				}
			}
		})
	}
}
