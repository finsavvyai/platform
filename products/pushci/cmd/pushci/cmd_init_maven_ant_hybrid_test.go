package main

import (
	"os"
	"path/filepath"
	"testing"
)

const hybridAntXML = `<?xml version="1.0"?>
<project name="ninja" default="dist">
  <target name="clean"/>
  <target name="compile"/>
  <target name="dist"/>
  <target name="deploy-to-nexus"/>
</project>
`

const hybridPomXML = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.telia</groupId>
  <artifactId>NinjaCore</artifactId>
  <version>1.0.0</version>
</project>
`

func writeHybrid(t *testing.T, dir string, pom, ant bool) {
	t.Helper()
	if pom {
		if err := os.WriteFile(filepath.Join(dir, "pom.xml"), []byte(hybridPomXML), 0o644); err != nil {
			t.Fatalf("write pom: %v", err)
		}
	}
	if ant {
		if err := os.WriteFile(filepath.Join(dir, "build.xml"), []byte(hybridAntXML), 0o644); err != nil {
			t.Fatalf("write ant: %v", err)
		}
	}
}

// TestMavenAntHybrid_PomPresentSuppressesAnt captures the v1.6.3
// NinjaCore / NinjaDKMDWCInterface dogfood: a repo with BOTH a root
// pom.xml and a root build.xml must pick Maven. Ant is legacy and
// owns only deploy/dist-style tasks.
func TestMavenAntHybrid_PomPresentSuppressesAnt(t *testing.T) {
	dir := t.TempDir()
	writeHybrid(t, dir, true, true)
	if got := tryAntMigrate(dir); got != nil {
		t.Fatalf("hybrid repo: expected tryAntMigrate=nil so framework heuristic picks Maven, got %+v", got.Stages)
	}
}

// TestMavenAntHybrid_AntOnlyStillWorks ensures the guard doesn't
// regress the pure-Ant path. No pom.xml → Ant wins.
func TestMavenAntHybrid_AntOnlyStillWorks(t *testing.T) {
	dir := t.TempDir()
	writeHybrid(t, dir, false, true)
	if got := tryAntMigrate(dir); got == nil {
		t.Fatal("pure-Ant repo: expected migrated pipeline, got nil")
	}
}

// TestMavenAntHybrid_MavenOnly is a sanity check: pom.xml only →
// tryAntMigrate returns nil because there's no build.xml at all.
func TestMavenAntHybrid_MavenOnly(t *testing.T) {
	dir := t.TempDir()
	writeHybrid(t, dir, true, false)
	if got := tryAntMigrate(dir); got != nil {
		t.Fatalf("maven-only repo: expected nil, got %+v", got)
	}
}

// TestMavenAntHybrid_NeitherPresent asserts the empty-repo fallback
// path. No pom, no build.xml → tryAntMigrate nil.
func TestMavenAntHybrid_NeitherPresent(t *testing.T) {
	dir := t.TempDir()
	if got := tryAntMigrate(dir); got != nil {
		t.Fatalf("empty repo: expected nil, got %+v", got)
	}
}

// TestMavenAntHybrid_SubdirAntAlsoDeferstoMaven covers the real
// NinjaCore shape: root pom.xml exists, no root build.xml, but
// subtrees (ninja-core-root/common/build.xml) carry legacy Ant.
// Before the fix, the subdir Ant would win over the root Maven.
// After: any Ant anywhere yields to a root pom.xml.
func TestMavenAntHybrid_SubdirAntAlsoDeferstoMaven(t *testing.T) {
	dir := t.TempDir()
	writeHybrid(t, dir, true, false)
	sub := filepath.Join(dir, "legacy")
	if err := os.MkdirAll(sub, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(sub, "build.xml"), []byte(hybridAntXML), 0o644); err != nil {
		t.Fatalf("write sub ant: %v", err)
	}
	if got := tryAntMigrate(dir); got != nil {
		t.Fatalf("root-pom + subdir-Ant: expected nil (Maven wins), got %+v", got.Stages)
	}
}
