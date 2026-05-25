package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/deploy"
)

func TestPickCloudflareTarget(t *testing.T) {
	cases := []struct {
		name  string
		setup func(t *testing.T, dir string)
		want  deploy.Target
	}{
		{"wrangler.toml → Workers", func(t *testing.T, dir string) {
			_ = os.WriteFile(filepath.Join(dir, "wrangler.toml"), []byte("name = \"x\""), 0o644)
		}, deploy.TargetCloudflareWorkers},
		{"dist/index.html → Pages", func(t *testing.T, dir string) {
			_ = os.MkdirAll(filepath.Join(dir, "dist"), 0o755)
			_ = os.WriteFile(filepath.Join(dir, "dist", "index.html"), []byte("<html/>"), 0o644)
		}, deploy.TargetCloudflarePages},
		{"empty dir → Pages (default)", func(t *testing.T, dir string) {}, deploy.TargetCloudflarePages},
		{"build/index.html → Pages", func(t *testing.T, dir string) {
			_ = os.MkdirAll(filepath.Join(dir, "build"), 0o755)
			_ = os.WriteFile(filepath.Join(dir, "build", "index.html"), []byte("<html/>"), 0o644)
		}, deploy.TargetCloudflarePages},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			tc.setup(t, dir)
			if got := pickCloudflareTarget(dir); got != tc.want {
				t.Errorf("pickCloudflareTarget: got %s, want %s", got, tc.want)
			}
		})
	}
}

func TestWriteMinimalFlyToml(t *testing.T) {
	dir := t.TempDir()
	tomlPath := filepath.Join(dir, "fly.toml")
	if err := writeMinimalFlyToml(tomlPath, "My_App"); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(tomlPath)
	body := string(got)
	if !strings.Contains(body, `app = "my-app"`) {
		t.Errorf("expected sanitized app name, got: %s", body)
	}
	if !strings.Contains(body, `primary_region = "iad"`) {
		t.Errorf("expected default region: %s", body)
	}
}

func TestQuickstartPreflight_UnknownAlias(t *testing.T) {
	_, _, err := quickstartPreflight("railway", t.TempDir())
	if err == nil || !strings.Contains(err.Error(), "not a quickstart alias") {
		t.Errorf("expected unknown-alias error, got: %v", err)
	}
}

func TestCurbDeploySuccess_VoiceCheck(t *testing.T) {
	cases := map[string]string{
		"vercel":     "That's the deploy",
		"cloudflare": "Edge. Free",
		"fly":        "Closer to the user",
	}
	for alias, want := range cases {
		got := curbDeploySuccess(alias, "https://example.com")
		if !strings.Contains(got, want) {
			t.Errorf("%s: missing Curb phrase %q in %q", alias, want, got)
		}
	}
}
