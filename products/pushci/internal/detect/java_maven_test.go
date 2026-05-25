package detect

import (
	"os"
	"path/filepath"
	"testing"
)

const simplePom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>dk.norlys</groupId>
  <artifactId>billing-svc</artifactId>
  <version>1.2.3</version>
  <packaging>jar</packaging>
  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <junit.version>5.10.0</junit.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>${junit.version}</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>`

const parentPom = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>dk.norlys</groupId>
  <artifactId>platform</artifactId>
  <version>2.0.0</version>
  <packaging>pom</packaging>
  <modules>
    <module>svc-a</module>
    <module>svc-b</module>
  </modules>
</project>`

func TestParsePomXMLCoordinates(t *testing.T) {
	p, err := ParsePomXML([]byte(simplePom))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if p.GroupID != "dk.norlys" || p.ArtifactID != "billing-svc" || p.Version != "1.2.3" {
		t.Errorf("wrong coordinates: %+v", p)
	}
	if p.Packaging != "jar" {
		t.Errorf("packaging = %q", p.Packaging)
	}
}

func TestParsePomProperties(t *testing.T) {
	p, err := ParsePomXML([]byte(simplePom))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if got := p.Properties.Entries["junit.version"]; got != "5.10.0" {
		t.Errorf("junit.version = %q", got)
	}
	if got := p.JavaVersion(); got != "17" {
		t.Errorf("JavaVersion = %q", got)
	}
}

func TestParsePomResolveVersion(t *testing.T) {
	p, err := ParsePomXML([]byte(simplePom))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if got := p.ResolveVersion("${junit.version}"); got != "5.10.0" {
		t.Errorf("resolve junit.version = %q", got)
	}
	if got := p.ResolveVersion("${project.version}"); got != "1.2.3" {
		t.Errorf("resolve project.version = %q", got)
	}
	if got := p.ResolveVersion("${unknown}"); got != "${unknown}" {
		t.Errorf("unknown left intact: %q", got)
	}
}

func TestParsePomMultiModule(t *testing.T) {
	p, err := ParsePomXML([]byte(parentPom))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if !p.IsMultiModule() {
		t.Fatal("expected multi-module")
	}
	if len(p.Modules.Module) != 2 {
		t.Fatalf("modules = %v", p.Modules.Module)
	}
	if p.Packaging != "pom" {
		t.Errorf("packaging = %q", p.Packaging)
	}
}

func TestDetectMavenProject(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "pom.xml"), []byte(simplePom), 0o644)
	p, err := DetectMavenProject(dir)
	if err != nil {
		t.Fatalf("detect: %v", err)
	}
	if p == nil || p.ArtifactID != "billing-svc" {
		t.Errorf("detect returned %+v", p)
	}
}

func TestDetectMavenProjectMissing(t *testing.T) {
	dir := t.TempDir()
	p, err := DetectMavenProject(dir)
	if err != nil || p != nil {
		t.Errorf("expected nil,nil got %v, %v", p, err)
	}
}
