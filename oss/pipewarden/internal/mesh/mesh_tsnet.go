//go:build pipewarden_mesh

// mesh_tsnet.go links tailscale.com/tsnet so the default binary does not
// pay for ~300 transitive dependencies. Build with `-tags pipewarden_mesh`
// to enable; the default build leaves `start` nil and Init returns
// ErrNotBuilt as documented in mesh.go.
package mesh

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"tailscale.com/tsnet"
)

func init() {
	start = startTsnet
}

// startTsnet boots a userspace tsnet node and returns an *http.Client that
// dials peers over the tailnet. The auth key is not persisted to disk;
// state lives under cfg.StateDir per Tailscale's tsnet contract.
func startTsnet(cfg Config) (*http.Client, error) {
	if cfg.AuthKey == "" {
		return nil, fmt.Errorf("mesh: tailscale provider needs %s", envAuthKey)
	}

	srv := &tsnet.Server{
		Hostname:  cfg.Hostname,
		Dir:       cfg.StateDir,
		AuthKey:   cfg.AuthKey,
		Ephemeral: true,
	}

	// Block briefly until the node is up so callers see a working client.
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if _, err := srv.Up(ctx); err != nil {
		_ = srv.Close()
		return nil, fmt.Errorf("mesh: tsnet up: %w", err)
	}

	hc := srv.HTTPClient()
	if hc == nil {
		_ = srv.Close()
		return nil, fmt.Errorf("mesh: tsnet returned nil HTTPClient")
	}
	hc.Timeout = 30 * time.Second
	return hc, nil
}
