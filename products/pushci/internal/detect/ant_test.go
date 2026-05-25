package detect

import (
	"os"
	"path/filepath"
	"testing"
)

const sampleAntXML = `<?xml version="1.0"?>
<project name="demo" default="compile">
  <target name="clean"/>
  <target name="compile"/>
  <target name="test"/>
  <target name="dist"/>
</project>
`

func writeAntFile(t *testing.T, dir, rel string) {
	t.Helper()
	full := filepath.Join(dir, rel)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(full, []byte(sampleAntXML), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func TestScanAnt(t *testing.T) {
	cases := []struct {
		name  string
		files []string
		want  []string
	}{
		{"root", []string{"build.xml"}, []string{"build.xml"}},
		{"subdir", []string{"modules/util/build.xml"}, []string{"modules/util/build.xml"}},
		{"none", nil, nil},
		{"root and subdir", []string{"build.xml", "svc/build.xml"}, []string{"build.xml", "svc/build.xml"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			for _, f := range tc.files {
				writeAntFile(t, dir, f)
			}
			got := ScanAnt(dir)
			if len(got) != len(tc.want) {
				t.Fatalf("ScanAnt() len=%d want=%d (%v)", len(got), len(tc.want), got)
			}
			seen := map[string]bool{}
			for _, p := range got {
				if p.Marker != "ci:ant" {
					t.Errorf("marker = %q, want ci:ant", p.Marker)
				}
				seen[filepath.ToSlash(p.ConfigFile)] = true
			}
			for _, w := range tc.want {
				if !seen[w] {
					t.Errorf("missing %q in %+v", w, got)
				}
			}
		})
	}
}

func TestHasAnt(t *testing.T) {
	dir := t.TempDir()
	if HasAnt(dir) {
		t.Fatal("empty dir should not report Ant")
	}
	writeAntFile(t, dir, "build.xml")
	if !HasAnt(dir) {
		t.Fatal("root build.xml should report true")
	}
}
