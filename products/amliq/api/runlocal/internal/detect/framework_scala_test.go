package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectScalaFramework(t *testing.T) {
	tests := []struct {
		name  string
		setup func(dir string)
		want  string
	}{
		{"play in build.sbt", func(d string) {
			os.WriteFile(filepath.Join(d, "build.sbt"), []byte("play"), 0o644)
		}, "play"},
		{"no framework", func(d string) {
			os.WriteFile(filepath.Join(d, "build.sbt"), []byte("scalaVersion := \"3.3\""), 0o644)
		}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			tt.setup(dir)
			if got := detectScalaFramework(dir); got != tt.want {
				t.Errorf("detectScalaFramework() = %q, want %q", got, tt.want)
			}
		})
	}
}
