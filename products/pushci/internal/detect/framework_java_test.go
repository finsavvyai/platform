package detect

import (
	"os"
	"path/filepath"
	"testing"
)

// Real Spring Boot starter pom — has spring-boot-starter-parent.
const realSpringBootPom = `<?xml version="1.0"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
  </parent>
  <artifactId>my-boot-app</artifactId>
</project>`

// Real Spring Boot project using the maven plugin (no parent).
const springBootPluginPom = `<?xml version="1.0"?>
<project>
  <artifactId>plugin-app</artifactId>
  <build><plugins><plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
  </plugin></plugins></build>
</project>`

// NinjaDKGenericInterface regression: parent is telia-dk-parent,
// NOT org.springframework.boot. Spring Boot is only mentioned as a
// dependencyManagement entry for spring-boot-starter-jetty (used as
// a Jetty integration, not as a Boot app). Must NOT be detected.
const ninjaDKPom = `<?xml version="1.0"?>
<project>
  <parent>
    <artifactId>telia-dk-parent</artifactId>
    <groupId>dk.telia.maven</groupId>
    <version>1</version>
  </parent>
  <artifactId>ninja-dk-generic-interface-parent</artifactId>
  <packaging>pom</packaging>
  <properties><version.spring>4.1.7.RELEASE</version.spring></properties>
  <dependencyManagement><dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-jetty</artifactId>
      <version>${version.jetty}</version>
    </dependency>
  </dependencies></dependencyManagement>
</project>`

const springBootGroovyGradle = `
plugins {
  id 'java'
  id 'org.springframework.boot' version '3.2.0'
}
`

const springBootKotlinGradle = `
plugins {
  id("org.springframework.boot") version "3.2.1"
}
`

func TestDetectJavaFramework(t *testing.T) {
	tests := []struct {
		name  string
		setup func(dir string)
		want  string
	}{
		{"real spring-boot parent pom", func(d string) {
			os.WriteFile(filepath.Join(d, "pom.xml"), []byte(realSpringBootPom), 0o644)
		}, "spring-boot"},
		{"spring-boot maven plugin pom", func(d string) {
			os.WriteFile(filepath.Join(d, "pom.xml"), []byte(springBootPluginPom), 0o644)
		}, "spring-boot"},
		{"ninjaDK aggregator pom (no boot)", func(d string) {
			os.WriteFile(filepath.Join(d, "pom.xml"), []byte(ninjaDKPom), 0o644)
		}, ""},
		{"empty pom", func(d string) {
			os.WriteFile(filepath.Join(d, "pom.xml"), []byte("<project/>"), 0o644)
		}, ""},
		{"spring-boot groovy gradle", func(d string) {
			os.WriteFile(filepath.Join(d, "build.gradle"), []byte(springBootGroovyGradle), 0o644)
		}, "spring-boot"},
		{"spring-boot kotlin gradle", func(d string) {
			os.WriteFile(filepath.Join(d, "build.gradle.kts"), []byte(springBootKotlinGradle), 0o644)
		}, "spring-boot"},
		{"quarkus in build.gradle", func(d string) {
			os.WriteFile(filepath.Join(d, "build.gradle"), []byte("quarkus"), 0o644)
		}, "quarkus"},
		{"micronaut in build.gradle.kts", func(d string) {
			os.WriteFile(filepath.Join(d, "build.gradle.kts"), []byte("micronaut"), 0o644)
		}, "micronaut"},
		{"android in build.gradle", func(d string) {
			os.WriteFile(filepath.Join(d, "build.gradle"), []byte("com.android.application"), 0o644)
		}, "android"},
		{"kotlin in build.gradle.kts", func(d string) {
			os.WriteFile(filepath.Join(d, "build.gradle.kts"), []byte("kotlin(\"jvm\")"), 0o644)
		}, "kotlin"},
		{"no framework", func(d string) {}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			tt.setup(dir)
			if got := detectJavaFramework(dir); got != tt.want {
				t.Errorf("detectJavaFramework() = %q, want %q", got, tt.want)
			}
		})
	}
}
