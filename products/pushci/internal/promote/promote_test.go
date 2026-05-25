package promote

import "testing"

func TestDefaultPackage(t *testing.T) {
	pkg := DefaultPackage()
	if pkg.Name != "pushci" {
		t.Errorf("name = %q, want pushci", pkg.Name)
	}
	if len(pkg.Categories) == 0 {
		t.Error("expected categories")
	}
	if len(pkg.Keywords) == 0 {
		t.Error("expected keywords")
	}
}

func TestDefaultGPTAction(t *testing.T) {
	action := DefaultGPTAction()
	if action.OpenAPISpec == "" {
		t.Error("expected openapi spec URL")
	}
	if action.PluginManifest == "" {
		t.Error("expected plugin manifest URL")
	}
}

func TestVerifyEndpoints(t *testing.T) {
	results := VerifyEndpoints()
	if len(results) < 6 {
		t.Fatalf("expected >=6 endpoints, got %d", len(results))
	}
	for _, r := range results {
		if r.Name == "" {
			t.Error("endpoint missing name")
		}
	}
}

func TestSubmitToSearchEngines(t *testing.T) {
	results := SubmitToSearchEngines("https://pushci.dev/sitemap.xml")
	if len(results) != 2 {
		t.Fatalf("expected 2 engines, got %d", len(results))
	}
	for _, r := range results {
		if r.Status != "ok" && r.Status != "error" {
			t.Errorf("%s: unexpected status %q", r.Name, r.Status)
		}
	}
}

func TestWriteGPTConfig(t *testing.T) {
	dir := t.TempDir()
	path, err := WriteGPTConfig(dir)
	if err != nil {
		t.Fatal(err)
	}
	if path == "" {
		t.Error("expected path")
	}
}
