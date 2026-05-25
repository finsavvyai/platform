package detect

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeTouch(t *testing.T, dir, rel, body string) {
	t.Helper()
	full := filepath.Join(dir, rel)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func TestScanShellOnly_Detects(t *testing.T) {
	dir := t.TempDir()
	writeTouch(t, dir, "install.sh", "#!/bin/sh\n")
	writeTouch(t, dir, "deploy.sh", "#!/bin/sh\n")
	p := ScanShellOnly(dir)
	if p == nil {
		t.Fatal("expected shell-only detection")
	}
	if p.Marker != "project:shell-scripts" {
		t.Errorf("marker = %q", p.Marker)
	}
	if !strings.Contains(p.ConfigFile, "install.sh") ||
		!strings.Contains(p.ConfigFile, "deploy.sh") {
		t.Errorf("config missing scripts: %q", p.ConfigFile)
	}
}

func TestScanShellOnly_SuppressedByBuildTool(t *testing.T) {
	cases := []string{"pom.xml", "package.json", "go.mod", "Cargo.toml",
		"pyproject.toml", "build.gradle", "build.xml", "Makefile"}
	for _, name := range cases {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			writeTouch(t, dir, "install.sh", "#!/bin/sh\n")
			writeTouch(t, dir, name, "x")
			if p := ScanShellOnly(dir); p != nil {
				t.Errorf("should suppress for %s, got %+v", name, p)
			}
		})
	}
}

func TestScanShellOnly_SuppressedByLegacyWAR(t *testing.T) {
	dir := t.TempDir()
	writeTouch(t, dir, "install.sh", "#!/bin/sh\n")
	writeTouch(t, dir, "web/WEB-INF/web.xml", `<web-app/>`)
	if p := ScanShellOnly(dir); p != nil {
		t.Errorf("legacy WAR should win, got %+v", p)
	}
}

func TestScanShellOnly_NoScripts(t *testing.T) {
	dir := t.TempDir()
	if p := ScanShellOnly(dir); p != nil {
		t.Errorf("empty dir should not trigger, got %+v", p)
	}
}

func TestScanShellOnly_IgnoresSubdirScripts(t *testing.T) {
	dir := t.TempDir()
	writeTouch(t, dir, "examples/foo.sh", "#!/bin/sh\n")
	if p := ScanShellOnly(dir); p != nil {
		t.Errorf("subdir-only scripts should not trigger, got %+v", p)
	}
}

func TestHasShellOnly(t *testing.T) {
	dir := t.TempDir()
	if HasShellOnly(dir) {
		t.Fatal("empty dir should not report shell-only")
	}
	writeTouch(t, dir, "install.sh", "#!/bin/sh\n")
	if !HasShellOnly(dir) {
		t.Fatal("install.sh should report true")
	}
}
