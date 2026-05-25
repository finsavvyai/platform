package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNodeScripts(t *testing.T) {
	tests := []struct {
		name    string
		content string
		want    map[string]bool
	}{
		{
			name:    "all scripts present",
			content: `{"scripts":{"build":"vite build","test":"vitest","lint":"eslint ."}}`,
			want:    map[string]bool{"build": true, "test": true, "lint": true},
		},
		{
			name:    "no build script",
			content: `{"scripts":{"test":"jest","lint":"eslint ."}}`,
			want:    map[string]bool{"test": true, "lint": true},
		},
		{
			name:    "default test script excluded",
			content: `{"scripts":{"test":"echo \"Error: no test specified\" && exit 1"}}`,
			want:    map[string]bool{},
		},
		{
			name:    "no scripts section",
			content: `{"name":"my-app","version":"1.0.0"}`,
			want:    map[string]bool{},
		},
		{
			name:    "empty scripts",
			content: `{"scripts":{}}`,
			want:    map[string]bool{},
		},
		{
			name:    "only dev script",
			content: `{"scripts":{"dev":"vite"}}`,
			want:    map[string]bool{"dev": true},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			os.WriteFile(filepath.Join(dir, "package.json"), []byte(tt.content), 0o644)
			got := NodeScripts(dir)
			if got == nil {
				got = map[string]bool{}
			}
			if len(got) != len(tt.want) {
				t.Fatalf("NodeScripts() = %v, want %v", got, tt.want)
			}
			for k, v := range tt.want {
				if got[k] != v {
					t.Errorf("script %q = %v, want %v", k, got[k], v)
				}
			}
		})
	}
}

func TestNodeScriptsMissingFile(t *testing.T) {
	dir := t.TempDir()
	got := NodeScripts(dir)
	if got != nil {
		t.Errorf("expected nil for missing package.json, got %v", got)
	}
}
