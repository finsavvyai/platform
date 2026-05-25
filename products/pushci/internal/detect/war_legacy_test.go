package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func writeWebXML(t *testing.T, dir, rel string) {
	t.Helper()
	full := filepath.Join(dir, rel)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(full, []byte(`<web-app/>`), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func TestScanLegacyWAR_Detected(t *testing.T) {
	dir := t.TempDir()
	writeWebXML(t, dir, "web/WEB-INF/web.xml")
	p := ScanLegacyWAR(dir)
	if p == nil {
		t.Fatal("expected legacy WAR detection")
	}
	if p.Marker != "project:java-war-legacy" {
		t.Errorf("marker = %q, want project:java-war-legacy", p.Marker)
	}
	if p.ConfigFile != "web/WEB-INF/web.xml" {
		t.Errorf("config = %q, want web/WEB-INF/web.xml", p.ConfigFile)
	}
}

func TestScanLegacyWAR_SuppressedByBuildTool(t *testing.T) {
	cases := []string{"pom.xml", "build.gradle", "build.gradle.kts", "build.xml"}
	for _, name := range cases {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			writeWebXML(t, dir, "web/WEB-INF/web.xml")
			if err := os.WriteFile(filepath.Join(dir, name), []byte(`x`), 0o644); err != nil {
				t.Fatalf("write: %v", err)
			}
			if p := ScanLegacyWAR(dir); p != nil {
				t.Errorf("should suppress when %s is present, got %+v", name, p)
			}
		})
	}
}

func TestScanLegacyWAR_NoWebXML(t *testing.T) {
	dir := t.TempDir()
	if p := ScanLegacyWAR(dir); p != nil {
		t.Errorf("empty dir should not detect, got %+v", p)
	}
}

func TestScanLegacyWAR_IgnoresNonWebInf(t *testing.T) {
	dir := t.TempDir()
	writeWebXML(t, dir, "docs/web.xml")
	if p := ScanLegacyWAR(dir); p != nil {
		t.Errorf("non-WEB-INF web.xml should not trigger, got %+v", p)
	}
}

func TestHasLegacyWAR(t *testing.T) {
	dir := t.TempDir()
	if HasLegacyWAR(dir) {
		t.Fatal("empty dir should not report legacy WAR")
	}
	writeWebXML(t, dir, "web/WEB-INF/web.xml")
	if !HasLegacyWAR(dir) {
		t.Fatal("WEB-INF/web.xml should report true")
	}
}
