package detect

import (
	"os"
	"path/filepath"
	"sort"
	"testing"
)

const sampleBuildspec = "version: 0.2\nphases:\n  build:\n    commands:\n      - make test\n"

func writeBuildspec(t *testing.T, dir, rel string) {
	t.Helper()
	full := filepath.Join(dir, rel)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(full, []byte(sampleBuildspec), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func TestScanBuildspec(t *testing.T) {
	cases := []struct {
		name  string
		files []string
		want  []string
	}{
		{"root yml", []string{"buildspec.yml"}, []string{"buildspec.yml"}},
		{"root yaml", []string{"buildspec.yaml"}, []string{"buildspec.yaml"}},
		{"env variants", []string{"buildspec_prod.yml", "buildspec_dev.yml"}, []string{"buildspec_dev.yml", "buildspec_prod.yml"}},
		{"subdir", []string{"services/api/buildspec.yml"}, []string{"services/api/buildspec.yml"}},
		{"none", []string{"README.md"}, nil},
		{"unrelated yml", []string{"other.yml"}, nil},
		{"mixed root and env", []string{"buildspec.yml", "buildspec_prod.yaml"}, []string{"buildspec.yml", "buildspec_prod.yaml"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			for _, f := range tc.files {
				writeBuildspec(t, dir, f)
			}
			got := ScanBuildspec(dir)
			if len(got) != len(tc.want) {
				t.Fatalf("len=%d want=%d (%+v)", len(got), len(tc.want), got)
			}
			paths := make([]string, 0, len(got))
			for _, p := range got {
				if p.Marker != "ci:aws-codebuild" {
					t.Errorf("marker=%q want ci:aws-codebuild", p.Marker)
				}
				paths = append(paths, filepath.ToSlash(p.ConfigFile))
			}
			sort.Strings(paths)
			sort.Strings(tc.want)
			for i := range paths {
				if paths[i] != tc.want[i] {
					t.Errorf("path[%d]=%q want %q", i, paths[i], tc.want[i])
				}
			}
		})
	}
}

func TestHasBuildspec(t *testing.T) {
	dir := t.TempDir()
	if HasBuildspec(dir) {
		t.Fatal("empty dir should not report buildspec")
	}
	writeBuildspec(t, dir, "buildspec.yml")
	if !HasBuildspec(dir) {
		t.Fatal("root buildspec.yml should report true")
	}
}

func TestBuildspecSkipsVendored(t *testing.T) {
	dir := t.TempDir()
	// Vendored buildspec inside node_modules must not surface.
	writeBuildspec(t, dir, "node_modules/pkg/buildspec.yml")
	if got := ScanBuildspec(dir); len(got) != 0 {
		t.Fatalf("want no hits inside node_modules, got %+v", got)
	}
}

func TestScanCIProvidersIncludesBuildspec(t *testing.T) {
	dir := t.TempDir()
	writeBuildspec(t, dir, "buildspec.yml")
	got := ScanCIProviders(dir)
	if len(got) != 1 || got[0].Marker != "ci:aws-codebuild" {
		t.Fatalf("ScanCIProviders=%+v want single ci:aws-codebuild", got)
	}
}
