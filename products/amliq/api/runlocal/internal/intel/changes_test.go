package intel

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestAffectedProjects(t *testing.T) {
	projects := []detect.Project{
		{Stack: detect.Node, Dir: "web"},
		{Stack: detect.Go, Dir: "internal"},
	}

	tests := []struct {
		name    string
		changes []string
		wantN   int
		wantDir string
	}{
		{"web change", []string{"web/src/App.tsx"}, 1, "web"},
		{"internal change", []string{"internal/main.go"}, 1, "internal"},
		{"no changes", []string{}, 0, ""},
		{"multi project", []string{"web/index.ts", "internal/foo.go"}, 2, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := AffectedProjects(tt.changes, projects)
			if len(got) != tt.wantN {
				t.Errorf("got %d projects, want %d", len(got), tt.wantN)
			}
			if tt.wantDir != "" && len(got) > 0 && got[0].Dir != tt.wantDir {
				t.Errorf("got dir %q, want %q", got[0].Dir, tt.wantDir)
			}
		})
	}
}

func TestAffectedProjectsRoot(t *testing.T) {
	// Root project "." matches any changed file.
	projects := []detect.Project{{Stack: detect.Go, Dir: "."}}
	got := AffectedProjects([]string{"anything.go"}, projects)
	if len(got) != 1 {
		t.Errorf("root project should match any file, got %d", len(got))
	}
}

func TestAffectedChecks(t *testing.T) {
	proj := detect.Project{Stack: detect.Go, Dir: "internal"}

	tests := []struct {
		name    string
		changes []string
		want    []string
	}{
		{"only tests", []string{"internal/foo_test.go"}, []string{"test"}},
		{"only src", []string{"internal/foo.go"}, []string{"build", "test"}},
		{"mixed", []string{"internal/foo.go", "internal/foo_test.go"},
			[]string{"build", "test"}},
		{"no match", []string{"web/app.tsx"}, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := AffectedChecks(tt.changes, proj)
			if len(got) != len(tt.want) {
				t.Errorf("got %v, want %v", got, tt.want)
				return
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("check[%d] = %q, want %q", i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestIsTestFile(t *testing.T) {
	tests := []struct {
		file string
		want bool
	}{
		{"foo_test.go", true},
		{"App.test.tsx", true},
		{"foo.spec.ts", true},
		{"main.go", false},
		{"index.ts", false},
	}
	for _, tt := range tests {
		t.Run(tt.file, func(t *testing.T) {
			if got := isTestFile(tt.file); got != tt.want {
				t.Errorf("isTestFile(%q) = %v, want %v", tt.file, got, tt.want)
			}
		})
	}
}
