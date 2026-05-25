package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectGoFramework(t *testing.T) {
	tests := []struct {
		name  string
		setup func(dir string)
		want  string
	}{
		{"gin-gonic in go.mod", func(d string) {
			os.WriteFile(filepath.Join(d, "go.mod"), []byte("require github.com/gin-gonic/gin v1.9"), 0o644)
		}, "gin"},
		{"labstack/echo in go.mod", func(d string) {
			os.WriteFile(filepath.Join(d, "go.mod"), []byte("require github.com/labstack/echo/v4"), 0o644)
		}, "echo"},
		{"gofiber in go.mod", func(d string) {
			os.WriteFile(filepath.Join(d, "go.mod"), []byte("require github.com/gofiber/fiber/v2"), 0o644)
		}, "fiber"},
		{"go-chi in go.mod", func(d string) {
			os.WriteFile(filepath.Join(d, "go.mod"), []byte("require github.com/go-chi/chi/v5"), 0o644)
		}, "chi"},
		{"templ in go.mod", func(d string) {
			os.WriteFile(filepath.Join(d, "go.mod"), []byte("require github.com/a-h/templ v0.2"), 0o644)
		}, "templ"},
		{"no framework", func(d string) {
			os.WriteFile(filepath.Join(d, "go.mod"), []byte("module example.com/app"), 0o644)
		}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			tt.setup(dir)
			if got := detectGoFramework(dir); got != tt.want {
				t.Errorf("detectGoFramework() = %q, want %q", got, tt.want)
			}
		})
	}
}
