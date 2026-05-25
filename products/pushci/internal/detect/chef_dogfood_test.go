package detect

import (
	"os"
	"testing"
)

// TestChefDogfoodTelia validates ScanChef against the real-world
// Telia cookbook repo at /Users/shaharsolomon/projects/telia/Chef.
// Skipped when the fixture isn't present (CI hosts, other machines).
func TestChefDogfoodTelia(t *testing.T) {
	root := "/Users/shaharsolomon/projects/telia/Chef"
	if _, err := os.Stat(root); err != nil {
		t.Skipf("telia/Chef fixture absent: %v", err)
	}
	got := ScanChef(root)
	if got == nil {
		t.Fatalf("ScanChef(%q) returned nil, want ci:chef marker", root)
	}
	if got.Marker != "ci:chef" {
		t.Errorf("marker=%q want ci:chef", got.Marker)
	}
	if got.ConfigFile != "cookbooks" {
		t.Errorf("ConfigFile=%q want cookbooks", got.ConfigFile)
	}
	providers := ScanCIProviders(root)
	for _, p := range providers {
		if p.Marker == "ci:chef" {
			return
		}
	}
	t.Fatalf("ScanCIProviders(%q)=%+v missing ci:chef", root, providers)
}
