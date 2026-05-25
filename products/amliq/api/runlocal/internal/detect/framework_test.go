package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectNodeFramework(t *testing.T) {
	tests := []struct {
		name  string
		setup func(dir string)
		want  string
	}{
		{"next.config.js", func(d string) {
			os.WriteFile(filepath.Join(d, "next.config.js"), []byte(""), 0o644)
		}, "nextjs"},
		{"nuxt.config.ts", func(d string) {
			os.WriteFile(filepath.Join(d, "nuxt.config.ts"), []byte(""), 0o644)
		}, "nuxt"},
		{"vite in package.json", func(d string) {
			os.WriteFile(filepath.Join(d, "package.json"), []byte(`{"devDependencies":{"vite":"5"}}`), 0o644)
		}, "vite"},
		{"gatsby-config.js", func(d string) {
			os.WriteFile(filepath.Join(d, "gatsby-config.js"), []byte(""), 0o644)
		}, "gatsby"},
		{"docusaurus.config.js", func(d string) {
			os.WriteFile(filepath.Join(d, "docusaurus.config.js"), []byte(""), 0o644)
		}, "docusaurus"},
		{".storybook dir", func(d string) {
			os.MkdirAll(filepath.Join(d, ".storybook"), 0o755)
		}, "storybook"},
		{"turbo.json", func(d string) {
			os.WriteFile(filepath.Join(d, "turbo.json"), []byte("{}"), 0o644)
		}, "turborepo"},
		{"expo in package.json", func(d string) {
			os.WriteFile(filepath.Join(d, "package.json"), []byte(`{"dependencies":{"expo":"49"}}`), 0o644)
		}, "expo"},
		{"electron in package.json", func(d string) {
			os.WriteFile(filepath.Join(d, "package.json"), []byte(`{"devDependencies":{"electron":"26"}}`), 0o644)
		}, "electron"},
		{"hono in package.json", func(d string) {
			os.WriteFile(filepath.Join(d, "package.json"), []byte(`{"dependencies":{"hono":"3"}}`), 0o644)
		}, "hono"},
		{"elysia in package.json", func(d string) {
			os.WriteFile(filepath.Join(d, "package.json"), []byte(`{"dependencies":{"elysia":"0.7"}}`), 0o644)
		}, "elysia"},
		{"t3 in package.json", func(d string) {
			os.WriteFile(filepath.Join(d, "package.json"), []byte(`{"devDependencies":{"create-t3-app":"7"}}`), 0o644)
		}, "t3"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			tt.setup(dir)
			if got := detectNodeFramework(dir); got != tt.want {
				t.Errorf("detectNodeFramework() = %q, want %q", got, tt.want)
			}
		})
	}
}
