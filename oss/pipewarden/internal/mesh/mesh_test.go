package mesh

import (
	"testing"
)

func TestLoadConfigDefaults(t *testing.T) {
	t.Setenv(envEnabled, "")
	t.Setenv(envProvider, "")
	t.Setenv(envStateDir, "")
	t.Setenv(envHostname, "")

	cfg := LoadConfig()
	if cfg.Enabled {
		t.Error("expected disabled by default")
	}
	if cfg.Provider != "tailscale" {
		t.Errorf("expected provider=tailscale, got %q", cfg.Provider)
	}
	if cfg.StateDir != "/var/lib/pipewarden/mesh" {
		t.Errorf("expected default state dir, got %q", cfg.StateDir)
	}
	if cfg.Hostname != "pipewarden" {
		t.Errorf("expected default hostname, got %q", cfg.Hostname)
	}
}

func TestLoadConfigEnabled(t *testing.T) {
	t.Setenv(envEnabled, "true")
	t.Setenv(envAuthKey, "tskey-auth-xxx")
	t.Setenv(envHostname, "pw-prod-1")

	cfg := LoadConfig()
	if !cfg.Enabled {
		t.Error("expected enabled")
	}
	if cfg.AuthKey != "tskey-auth-xxx" {
		t.Errorf("authkey not loaded: %q", cfg.AuthKey)
	}
	if cfg.Hostname != "pw-prod-1" {
		t.Errorf("hostname not loaded: %q", cfg.Hostname)
	}
}

func TestClientFallbackWhenInactive(t *testing.T) {
	reset(t)
	c := Client()
	if c == nil {
		t.Fatal("Client() must not return nil")
	}
	if Active() {
		t.Error("expected inactive when no provider started")
	}
}

func TestInitReturnsErrNotBuiltWhenEnabled(t *testing.T) {
	reset(t)
	t.Setenv(envEnabled, "true")
	if err := Init(); err != ErrNotBuilt {
		t.Errorf("expected ErrNotBuilt, got %v", err)
	}
}

func TestInitNoopWhenDisabled(t *testing.T) {
	reset(t)
	t.Setenv(envEnabled, "false")
	if err := Init(); err != nil {
		t.Errorf("Init disabled should be noop, got %v", err)
	}
}

// reset clears package-level state between tests. Mesh has no public
// reset because a long-lived process never tears the mesh down mid-run;
// tests need the escape hatch.
func reset(t *testing.T) {
	t.Helper()
	mu.Lock()
	defer mu.Unlock()
	meshClient = nil
	initialized = false
}
