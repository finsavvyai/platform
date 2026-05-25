package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectJavaBuildTool(t *testing.T) {
	cases := []struct {
		name  string
		files []string
		want  JavaTool
	}{
		{"empty dir", nil, JavaToolUnknown},
		{"maven only", []string{"pom.xml"}, JavaToolMaven},
		{"gradle groovy only", []string{"build.gradle"}, JavaToolGradle},
		{"gradle kotlin only", []string{"build.gradle.kts"}, JavaToolGradle},
		{"settings.gradle alone", []string{"settings.gradle"}, JavaToolGradle},
		{"gradle wrapper alone", []string{"gradlew"}, JavaToolGradle},
		{"mixed", []string{"pom.xml", "build.gradle"}, JavaToolMixed},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			for _, f := range tc.files {
				path := filepath.Join(dir, f)
				if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
					t.Fatal(err)
				}
			}
			if got := DetectJavaBuildTool(dir); got != tc.want {
				t.Fatalf("DetectJavaBuildTool(%v) = %v, want %v", tc.files, got, tc.want)
			}
		})
	}
}

func TestJavaBuildToolToBuildTool(t *testing.T) {
	cases := map[JavaTool]BuildTool{
		JavaToolMaven:   ToolMaven,
		JavaToolGradle:  ToolGradle,
		JavaToolMixed:   ToolMaven,
		JavaToolUnknown: "",
	}
	for in, want := range cases {
		if got := JavaBuildToolToBuildTool(in); got != want {
			t.Errorf("JavaBuildToolToBuildTool(%v) = %v, want %v", in, got, want)
		}
	}
}

func TestHasGradleWrapper(t *testing.T) {
	dir := t.TempDir()
	if HasGradleWrapper(dir) {
		t.Fatal("empty dir should not report wrapper")
	}
	if err := os.WriteFile(filepath.Join(dir, "gradlew"), []byte("#!/bin/sh"), 0o755); err != nil {
		t.Fatal(err)
	}
	if !HasGradleWrapper(dir) {
		t.Fatal("expected wrapper detection after writing gradlew")
	}
}

func TestIsMavenAggregator(t *testing.T) {
	aggregator := t.TempDir()
	if err := os.WriteFile(filepath.Join(aggregator, "pom.xml"), []byte(`
<project><modules><module>a</module><module>b</module></modules></project>`), 0o644); err != nil {
		t.Fatal(err)
	}
	if !IsMavenAggregator(aggregator) {
		t.Fatal("aggregator pom with modules and no src/ should be true")
	}

	withSrc := t.TempDir()
	if err := os.MkdirAll(filepath.Join(withSrc, "src", "main"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(withSrc, "pom.xml"), []byte(`
<project><modules><module>a</module></modules></project>`), 0o644); err != nil {
		t.Fatal(err)
	}
	if IsMavenAggregator(withSrc) {
		t.Fatal("pom with src/main must not be treated as aggregator")
	}

	leaf := t.TempDir()
	if err := os.WriteFile(filepath.Join(leaf, "pom.xml"), []byte(`
<project></project>`), 0o644); err != nil {
		t.Fatal(err)
	}
	if IsMavenAggregator(leaf) {
		t.Fatal("leaf pom without modules must not be aggregator")
	}
}
