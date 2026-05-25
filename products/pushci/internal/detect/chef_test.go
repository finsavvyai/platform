package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func writeChefFile(t *testing.T, dir, rel string) {
	t.Helper()
	full := filepath.Join(dir, rel)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(full, []byte("# stub\n"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func TestScanChef(t *testing.T) {
	cases := []struct {
		name       string
		files      []string
		wantMarker bool
		wantConfig string
	}{
		{"multi-cookbook telia", []string{"cookbooks/neo/metadata.rb", "cookbooks/java/metadata.rb", "cookbooks/ark/metadata.rb"}, true, "cookbooks"},
		{"berksfile", []string{"Berksfile"}, true, "Berksfile"},
		{"policyfile", []string{"Policyfile.rb"}, true, "Policyfile.rb"},
		{"policyfile lock", []string{"Policyfile.lock.json"}, true, "Policyfile.lock.json"},
		{"single cookbook metadata.rb", []string{"metadata.rb"}, true, "metadata.rb"},
		{"kitchen only (weak alone)", []string{".kitchen.yml"}, false, ""},
		{"kitchen + metadata medium pair", []string{".kitchen.yml", "metadata.rb"}, true, "metadata.rb"},
		{"none", []string{"README.md"}, false, ""},
		{"only roles weak", []string{"roles/web.rb", "environments/prod.rb"}, false, ""},
		{"case-insensitive berksfile", []string{"berksfile"}, true, "Berksfile"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			for _, f := range tc.files {
				writeChefFile(t, dir, f)
			}
			got := ScanChef(dir)
			if tc.wantMarker {
				if got == nil {
					t.Fatalf("want marker, got nil")
				}
				if got.Marker != "ci:chef" {
					t.Errorf("marker=%q want ci:chef", got.Marker)
				}
				if filepath.ToSlash(got.ConfigFile) != tc.wantConfig {
					t.Errorf("ConfigFile=%q want %q", got.ConfigFile, tc.wantConfig)
				}
			} else if got != nil {
				t.Errorf("want nil, got %+v", got)
			}
		})
	}
}

func TestHasChef(t *testing.T) {
	dir := t.TempDir()
	if HasChef(dir) {
		t.Fatal("empty dir should not report chef")
	}
	writeChefFile(t, dir, "Berksfile")
	if !HasChef(dir) {
		t.Fatal("Berksfile should report true")
	}
}

func TestScanCIProvidersIncludesChef(t *testing.T) {
	dir := t.TempDir()
	writeChefFile(t, dir, "cookbooks/neo/metadata.rb")
	got := ScanCIProviders(dir)
	for _, p := range got {
		if p.Marker == "ci:chef" {
			return
		}
	}
	t.Fatalf("ScanCIProviders=%+v missing ci:chef", got)
}
