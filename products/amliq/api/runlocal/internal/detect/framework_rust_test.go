package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectRustFramework(t *testing.T) {
	tests := []struct {
		name  string
		setup func(dir string)
		want  string
	}{
		{"actix-web in Cargo.toml", func(d string) {
			os.WriteFile(filepath.Join(d, "Cargo.toml"), []byte("actix-web = \"4\""), 0o644)
		}, "actix"},
		{"axum in Cargo.toml", func(d string) {
			os.WriteFile(filepath.Join(d, "Cargo.toml"), []byte("axum = \"0.7\""), 0o644)
		}, "axum"},
		{"rocket in Cargo.toml", func(d string) {
			os.WriteFile(filepath.Join(d, "Cargo.toml"), []byte("rocket = \"0.5\""), 0o644)
		}, "rocket"},
		{"tauri in Cargo.toml", func(d string) {
			os.WriteFile(filepath.Join(d, "Cargo.toml"), []byte("tauri = \"1.5\""), 0o644)
		}, "tauri"},
		{"leptos in Cargo.toml", func(d string) {
			os.WriteFile(filepath.Join(d, "Cargo.toml"), []byte("leptos = \"0.5\""), 0o644)
		}, "leptos"},
		{"no framework", func(d string) {
			os.WriteFile(filepath.Join(d, "Cargo.toml"), []byte("[package]\nname = \"app\""), 0o644)
		}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			tt.setup(dir)
			if got := detectRustFramework(dir); got != tt.want {
				t.Errorf("detectRustFramework() = %q, want %q", got, tt.want)
			}
		})
	}
}
