package secrets

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// VaultClient authenticates via AppRole and reads KV-v2 secrets.
type VaultClient struct {
	addr   string
	token  string
	mu     sync.Mutex
	cancel context.CancelFunc
}

// NewVaultClient exchanges role-id/secret-id for a scoped Vault token.
func NewVaultClient(ctx context.Context, addr, roleID, secretID string) (*VaultClient, error) {
	payload, _ := json.Marshal(map[string]string{"role_id": roleID, "secret_id": secretID})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, addr+"/v1/auth/approle/login", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("vault login: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("vault login: HTTP %d", resp.StatusCode)
	}
	var out struct {
		Auth struct {
			ClientToken   string `json:"client_token"`
			LeaseDuration int    `json:"lease_duration"`
		} `json:"auth"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("vault login decode: %w", err)
	}
	renewCtx, cancel := context.WithCancel(context.Background())
	vc := &VaultClient{addr: addr, token: out.Auth.ClientToken, cancel: cancel}
	if out.Auth.LeaseDuration > 0 {
		go vc.renewLoop(renewCtx, time.Duration(out.Auth.LeaseDuration)*time.Second/2)
	}
	return vc, nil
}

// currentToken returns the live Vault token under the mutex so
// concurrent Close() can race-safely zero it. Callers that hold the
// returned value briefly are fine — Close also revokes server-side.
func (vc *VaultClient) currentToken() string {
	vc.mu.Lock()
	defer vc.mu.Unlock()
	return vc.token
}

// Resolve fetches a vault://path#field secret from a KV-v2 mount.
func (vc *VaultClient) Resolve(ctx context.Context, ref string) (string, error) {
	if !strings.HasPrefix(ref, "vault://") {
		return "", fmt.Errorf("vault: not a vault:// ref: %s", ref)
	}
	parts := strings.SplitN(strings.TrimPrefix(ref, "vault://"), "#", 2)
	if len(parts) != 2 || parts[1] == "" {
		return "", fmt.Errorf("vault: missing #field in %s", ref)
	}
	path, field := parts[0], parts[1]
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, vc.addr+"/v1/"+path, nil)
	req.Header.Set("X-Vault-Token", vc.currentToken())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("vault read %s: %w", path, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("vault read %s: HTTP %d (req-id: %s)",
			path, resp.StatusCode, resp.Header.Get("X-Vault-Request-Id"))
	}
	var kv struct {
		Data struct {
			Data map[string]string `json:"data"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&kv); err != nil {
		return "", fmt.Errorf("vault read decode: %w", err)
	}
	v, ok := kv.Data.Data[field]
	if !ok {
		return "", fmt.Errorf("vault: field %q not at %s", field, path)
	}
	return v, nil
}
