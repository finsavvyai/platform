package detect

import (
	"os"
	"path/filepath"
	"testing"
)

const simpleGroovy = `
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.0'
}

group = 'com.norlys.example'
version = '1.0.0'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web:3.2.0'
    testImplementation 'junit:junit:4.13.2'
}
`

const kotlinDsl = `
plugins {
    kotlin("jvm") version "1.9.22"
    id("org.springframework.boot") version "3.2.1"
}

group = "com.norlys.kotlin"
version = "2.1.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}
`

const multiProjectSettings = `
rootProject.name = 'norlys-platform'
include 'svc-a', 'svc-b'
include ':svc-c'
`

func TestParseGradleGroovyCoordinates(t *testing.T) {
	b := parseGradleContent(simpleGroovy)
	if b.Group != "com.norlys.example" {
		t.Errorf("group = %q", b.Group)
	}
	if b.Version != "1.0.0" {
		t.Errorf("version = %q", b.Version)
	}
	if b.JavaVersion != "17" {
		t.Errorf("javaVersion = %q", b.JavaVersion)
	}
	if !containsStr(b.Plugins, "java") {
		t.Errorf("expected 'java' plugin, got %v", b.Plugins)
	}
	if !containsStr(b.Plugins, "org.springframework.boot") {
		t.Errorf("expected spring-boot plugin, got %v", b.Plugins)
	}
}

func TestParseGradleKotlinDSL(t *testing.T) {
	b := parseGradleContent(kotlinDsl)
	if b.Group != "com.norlys.kotlin" {
		t.Errorf("group = %q", b.Group)
	}
	if b.Version != "2.1.0" {
		t.Errorf("version = %q", b.Version)
	}
	if b.JavaVersion != "21" {
		t.Errorf("javaVersion = %q", b.JavaVersion)
	}
	if !containsStr(b.Plugins, "org.springframework.boot") {
		t.Errorf("expected spring-boot plugin, got %v", b.Plugins)
	}
	if !containsStr(b.Plugins, "org.jetbrains.kotlin.jvm") {
		t.Errorf("expected kotlin.jvm plugin, got %v", b.Plugins)
	}
}

func TestParseGradleJavaVersionSourceCompat(t *testing.T) {
	const legacy = `
sourceCompatibility = JavaVersion.VERSION_11
group = 'ex'
version = '1'
`
	b := parseGradleContent(legacy)
	if b.JavaVersion != "11" {
		t.Errorf("javaVersion = %q (expected 11)", b.JavaVersion)
	}
}

func TestParseSettingsInclude(t *testing.T) {
	subs := parseSettingsInclude(multiProjectSettings)
	want := map[string]bool{"svc-a": true, "svc-b": true, "svc-c": true}
	for _, s := range subs {
		if !want[s] {
			t.Errorf("unexpected subproject %q in %v", s, subs)
		}
		delete(want, s)
	}
	if len(want) != 0 {
		t.Errorf("missing subprojects: %v", want)
	}
}

func TestDetectGradleProject(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "build.gradle"), []byte(simpleGroovy), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "settings.gradle"), []byte(multiProjectSettings), 0o644); err != nil {
		t.Fatal(err)
	}
	b, err := DetectGradleProject(dir)
	if err != nil {
		t.Fatalf("detect: %v", err)
	}
	if b == nil {
		t.Fatal("expected non-nil build")
	}
	if b.Group != "com.norlys.example" {
		t.Errorf("group = %q", b.Group)
	}
	if !b.IsMultiProject() {
		t.Errorf("expected multi-project, subprojects=%v", b.Subprojects)
	}
	if len(b.Subprojects) != 3 {
		t.Errorf("subprojects = %v", b.Subprojects)
	}
}

func TestDetectGradleProjectMissing(t *testing.T) {
	dir := t.TempDir()
	b, err := DetectGradleProject(dir)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if b != nil {
		t.Errorf("expected nil build, got %+v", b)
	}
}

func TestDetectGradleKotlinDsl(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "build.gradle.kts"), []byte(kotlinDsl), 0o644); err != nil {
		t.Fatal(err)
	}
	b, err := DetectGradleProject(dir)
	if err != nil || b == nil {
		t.Fatalf("detect: %v %v", b, err)
	}
	if !b.IsKotlinDsl {
		t.Errorf("expected IsKotlinDsl=true for build.gradle.kts")
	}
	if b.JavaVersion != "21" {
		t.Errorf("javaVersion = %q", b.JavaVersion)
	}
}

func containsStr(slice []string, target string) bool {
	for _, s := range slice {
		if s == target {
			return true
		}
	}
	return false
}
