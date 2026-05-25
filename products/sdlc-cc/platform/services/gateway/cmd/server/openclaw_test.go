package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestDiscoverOpenClawCapabilities(t *testing.T) {
	tmp := t.TempDir()
	root := filepath.Join(tmp, "openclaw")

	mustMkdirAll(t, filepath.Join(root, "docs", "channels"))
	mustMkdirAll(t, filepath.Join(root, "docs", "nodes"))
	mustMkdirAll(t, filepath.Join(root, "extensions", "voice-call"))
	mustMkdirAll(t, filepath.Join(root, "extensions", "bluebubbles"))
	mustMkdirAll(t, filepath.Join(root, "skills", "voice-call"))

	mustWriteFile(t, filepath.Join(root, "docs", "channels", "slack.md"), "# slack")
	mustWriteFile(t, filepath.Join(root, "docs", "channels", "index.md"), "# index")
	mustWriteFile(t, filepath.Join(root, "docs", "nodes", "camera.md"), "# camera")
	mustWriteFile(t, filepath.Join(root, "skills", "voice-call", "SKILL.md"), "# skill")

	caps := discoverOpenClawCapabilities(root)
	if !caps.Available {
		t.Fatalf("expected available capabilities")
	}
	if len(caps.Channels) != 1 || caps.Channels[0] != "slack" {
		t.Fatalf("unexpected channels: %#v", caps.Channels)
	}
	if len(caps.Nodes) != 1 || caps.Nodes[0] != "camera" {
		t.Fatalf("unexpected nodes: %#v", caps.Nodes)
	}
	if len(caps.Extensions) != 2 {
		t.Fatalf("unexpected extensions: %#v", caps.Extensions)
	}
	if len(caps.Skills) != 1 || caps.Skills[0] != "voice-call" {
		t.Fatalf("unexpected skills: %#v", caps.Skills)
	}
}

func TestHandleOpenClawCapabilities(t *testing.T) {
	tmp := t.TempDir()
	root := filepath.Join(tmp, "openclaw")
	mustMkdirAll(t, filepath.Join(root, "docs", "channels"))
	mustWriteFile(t, filepath.Join(root, "docs", "channels", "telegram.md"), "# telegram")

	orig := os.Getenv("OPENCLAW_ROOT")
	t.Cleanup(func() { _ = os.Setenv("OPENCLAW_ROOT", orig) })
	if err := os.Setenv("OPENCLAW_ROOT", root); err != nil {
		t.Fatalf("set env: %v", err)
	}

	app := &Application{}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/openclaw/capabilities", nil)
	rr := httptest.NewRecorder()

	app.handleOpenClawCapabilities(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", rr.Code)
	}

	var caps OpenClawCapabilities
	if err := json.Unmarshal(rr.Body.Bytes(), &caps); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !caps.Available {
		t.Fatalf("expected available=true")
	}
	if len(caps.Channels) != 1 || caps.Channels[0] != "telegram" {
		t.Fatalf("unexpected channels: %#v", caps.Channels)
	}
}

func mustMkdirAll(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}
}

func mustWriteFile(t *testing.T, path string, data string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(data), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}
