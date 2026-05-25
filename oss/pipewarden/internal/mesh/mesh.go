// Package mesh abstracts the embedded WireGuard-style mesh client used by
// Enterprise+ self-hosted deployments to reach on-prem SIEMs without a
// firewall rule. The default implementation is a stub that returns a normal
// *http.Client — call sites work unchanged when the mesh is disabled.
//
// To swap in tailscale.com/tsnet, build with tag "pipewarden_mesh" and
// replace DefaultClient with a *tsnet.Server.HTTPClient() — see
// mesh_tsnet.go (added separately so the default binary does not pull in
// the 300+ transitive deps of tailscale.com/*).
package mesh

import (
	"errors"
	"net/http"
	"os"
	"sync"
	"time"
)

const (
	envEnabled  = "PIPEWARDEN_MESH_ENABLED"
	envProvider = "PIPEWARDEN_MESH_PROVIDER" // "tailscale" | "none"
	envAuthKey  = "TAILSCALE_AUTHKEY"
	envStateDir = "PIPEWARDEN_MESH_STATE_DIR"
	envHostname = "PIPEWARDEN_MESH_HOSTNAME"
)

// ErrNotBuilt is returned when Init is called but the mesh provider is
// configured yet the build does not include an implementation.
var ErrNotBuilt = errors.New("mesh: provider requested but binary was not built with the pipewarden_mesh tag")

// Config captures the env-driven knobs. Zero value = disabled.
type Config struct {
	Enabled  bool
	Provider string
	AuthKey  string
	StateDir string
	Hostname string
}

// LoadConfig reads the mesh knobs from the environment.
func LoadConfig() Config {
	return Config{
		Enabled:  os.Getenv(envEnabled) == "true",
		Provider: firstNonEmpty(os.Getenv(envProvider), "tailscale"),
		AuthKey:  os.Getenv(envAuthKey),
		StateDir: firstNonEmpty(os.Getenv(envStateDir), "/var/lib/pipewarden/mesh"),
		Hostname: firstNonEmpty(os.Getenv(envHostname), "pipewarden"),
	}
}

var (
	mu          sync.Mutex
	meshClient  *http.Client
	initialized bool
)

// Init starts the mesh client if enabled. Safe to call multiple times.
// Returns ErrNotBuilt if a provider was requested but no build-tagged
// implementation is linked.
func Init() error {
	mu.Lock()
	defer mu.Unlock()
	if initialized {
		return nil
	}
	initialized = true

	cfg := LoadConfig()
	if !cfg.Enabled {
		return nil
	}
	if start == nil {
		return ErrNotBuilt
	}
	c, err := start(cfg)
	if err != nil {
		return err
	}
	meshClient = c
	return nil
}

// Client returns an *http.Client bound to the mesh if active, or the
// default client if not. Callers should use this wherever they would
// otherwise use http.DefaultClient for outbound SIEM/webhook traffic.
func Client() *http.Client {
	mu.Lock()
	defer mu.Unlock()
	if meshClient != nil {
		return meshClient
	}
	return &http.Client{Timeout: 15 * time.Second}
}

// Active reports whether the mesh is running.
func Active() bool {
	mu.Lock()
	defer mu.Unlock()
	return meshClient != nil
}

// start is set by the build-tagged implementation (see mesh_tsnet.go).
// It remains nil in the default build; Init returns ErrNotBuilt in that
// case when a mesh provider is requested.
var start func(Config) (*http.Client, error)

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
