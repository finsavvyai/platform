package migrate

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeFile(t *testing.T, p, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatalf("mkdirall: %v", err)
	}
	if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
		t.Fatalf("writefile: %v", err)
	}
}

func mkChefCookbook(t *testing.T, root, name string, withSpec bool) {
	t.Helper()
	base := filepath.Join(root, "cookbooks", name)
	writeFile(t, filepath.Join(base, "metadata.rb"), "name '"+name+"'\n")
	writeFile(t, filepath.Join(base, "recipes", "default.rb"), "# default\n")
	if withSpec {
		writeFile(t, filepath.Join(base, "spec", "default_spec.rb"),
			"require 'chefspec'\n")
	}
}

func TestConvertChefSingleCookbook(t *testing.T) {
	root := t.TempDir()
	mkChefCookbook(t, root, "neo", true)

	r := ConvertChef(root)
	if len(r.Cookbooks) != 1 || r.Cookbooks[0] != "neo" {
		t.Fatalf("cookbooks = %v, want [neo]", r.Cookbooks)
	}
	if !strings.Contains(r.PushCIYAML, "chefspec-neo") {
		t.Errorf("missing chefspec stage:\n%s", r.PushCIYAML)
	}
	if !strings.Contains(r.PushCIYAML, "cookstyle cookbooks/") {
		t.Errorf("missing cookstyle lint:\n%s", r.PushCIYAML)
	}
	if strings.Contains(r.PushCIYAML, "kitchen test") {
		t.Errorf("integration should be skipped:\n%s", r.PushCIYAML)
	}
}

func TestConvertChefTeliaShape(t *testing.T) {
	root := t.TempDir()
	for _, cb := range []string{"neo", "java", "shared", "chef_handler", "ark"} {
		mkChefCookbook(t, root, cb, true)
	}
	writeFile(t, filepath.Join(root, "Berksfile"), "source 'https://supermarket.chef.io'\n")
	writeFile(t, filepath.Join(root, ".kitchen.yml"), "driver:\n  name: vagrant\n")
	writeFile(t, filepath.Join(root, "validate-changed-json-files.sh"), "#!/bin/sh\npython3 validate-json.py\n")
	writeFile(t, filepath.Join(root, "validate-json.py"), "import json\n")

	r := ConvertChef(root)
	if len(r.Cookbooks) != 5 {
		t.Fatalf("cookbooks = %v, want 5", r.Cookbooks)
	}
	if !r.HasKitchen || !r.HasBerksfile {
		t.Errorf("flags: kitchen=%v berks=%v", r.HasKitchen, r.HasBerksfile)
	}
	for _, want := range []string{"validate", "lint", "unit-test", "deps", "integration",
		"berks install", "berks verify", "kitchen test", "chefspec-shared"} {
		if !strings.Contains(r.PushCIYAML, want) {
			t.Errorf("YAML missing %q:\n%s", want, r.PushCIYAML)
		}
	}
}

func TestConvertChefNoSpecEmitsWarning(t *testing.T) {
	root := t.TempDir()
	mkChefCookbook(t, root, "neo", true)
	mkChefCookbook(t, root, "empty", false)

	r := ConvertChef(root)
	joined := strings.Join(r.Warnings, "\n")
	if !strings.Contains(joined, "No ChefSpec specs in cookbook 'empty'") {
		t.Errorf("missing no-spec warning:\n%s", joined)
	}
	if strings.Contains(r.PushCIYAML, "chefspec-empty") {
		t.Errorf("empty cookbook should not appear in unit-test:\n%s", r.PushCIYAML)
	}
}

func TestConvertChefNoKitchenNoBerks(t *testing.T) {
	root := t.TempDir()
	mkChefCookbook(t, root, "neo", true)

	r := ConvertChef(root)
	joined := strings.Join(r.Warnings, "\n")
	if !strings.Contains(joined, "No .kitchen.yml") {
		t.Errorf("missing kitchen warning:\n%s", joined)
	}
	if !strings.Contains(joined, "No dependency manifest") {
		t.Errorf("missing deps warning:\n%s", joined)
	}
}

func TestConvertChefMetadataPathAccepted(t *testing.T) {
	root := t.TempDir()
	mkChefCookbook(t, root, "neo", true)
	meta := filepath.Join(root, "cookbooks", "neo", "metadata.rb")

	r := ConvertChef(meta)
	if len(r.Cookbooks) == 0 {
		t.Fatalf("expected cookbooks detected from metadata.rb path, got none")
	}
}

func TestConvertChefPrintFirstLines(t *testing.T) {
	// Snapshot generator — prints first 40 lines for the 5-cookbook fixture
	// so humans reading the logs can eyeball the shape.
	root := t.TempDir()
	for _, cb := range []string{"ark", "chef_handler", "java", "neo", "shared"} {
		mkChefCookbook(t, root, cb, true)
	}
	writeFile(t, filepath.Join(root, "Berksfile"), "source 'x'\n")
	writeFile(t, filepath.Join(root, ".kitchen.yml"), "driver:\n  name: vagrant\n")
	writeFile(t, filepath.Join(root, "validate-json.py"), "import json\n")

	r := ConvertChef(root)
	lines := strings.Split(r.PushCIYAML, "\n")
	limit := 40
	if len(lines) < limit {
		limit = len(lines)
	}
	t.Logf("Telia-shaped pushci.yml (first %d lines):\n%s",
		limit, strings.Join(lines[:limit], "\n"))
}
