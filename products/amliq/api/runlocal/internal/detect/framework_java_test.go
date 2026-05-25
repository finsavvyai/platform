package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectJavaFramework(t *testing.T) {
	tests := []struct {
		name  string
		setup func(dir string)
		want  string
	}{
		{"spring-boot in pom.xml", func(d string) {
			os.WriteFile(filepath.Join(d, "pom.xml"), []byte("<spring-boot>"), 0o644)
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
