package detect

import (
	"os"
	"path/filepath"
	"testing"
)

const sampleJenkinsfile = `pipeline { agent any; stages { stage('test') { steps { sh 'make test' } } } }`

func writeJenkinsfile(t *testing.T, dir, rel string) {
	t.Helper()
	full := filepath.Join(dir, rel)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(full, []byte(sampleJenkinsfile), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func TestScanJenkins(t *testing.T) {
	cases := []struct {
		name  string
		files []string
		want  []string // expected relative paths (slash form)
	}{
		{"root", []string{"Jenkinsfile"}, []string{"Jenkinsfile"}},
		{"subdir", []string{"services/api/Jenkinsfile"}, []string{"services/api/Jenkinsfile"}},
		{"none", nil, nil},
		{"root and subdir", []string{"Jenkinsfile", "svc/Jenkinsfile"}, []string{"Jenkinsfile", "svc/Jenkinsfile"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			for _, f := range tc.files {
				writeJenkinsfile(t, dir, f)
			}
			got := ScanJenkins(dir)
			if len(got) != len(tc.want) {
				t.Fatalf("ScanJenkins() len=%d want=%d (%v)", len(got), len(tc.want), got)
			}
			seen := map[string]bool{}
			for _, p := range got {
				if p.Marker != "ci:jenkins" {
					t.Errorf("marker = %q, want ci:jenkins", p.Marker)
				}
				seen[filepath.ToSlash(p.ConfigFile)] = true
			}
			for _, w := range tc.want {
				if !seen[w] {
					t.Errorf("missing expected path %q in %+v", w, got)
				}
			}
		})
	}
}

func TestHasJenkins(t *testing.T) {
	dir := t.TempDir()
	if HasJenkins(dir) {
		t.Fatal("empty dir should not report Jenkins")
	}
	writeJenkinsfile(t, dir, "Jenkinsfile")
	if !HasJenkins(dir) {
		t.Fatal("root Jenkinsfile should report true")
	}
}

func TestScanCIProvidersIncludesJenkins(t *testing.T) {
	dir := t.TempDir()
	writeJenkinsfile(t, dir, "Jenkinsfile")
	got := ScanCIProviders(dir)
	if len(got) != 1 || got[0].Marker != "ci:jenkins" {
		t.Fatalf("ScanCIProviders() = %+v, want single ci:jenkins", got)
	}
}
