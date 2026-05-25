package secrets

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

func (vc *VaultClient) renewLoop(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			req, _ := http.NewRequest(http.MethodPost, vc.addr+"/v1/auth/token/renew-self", nil)
			req.Header.Set("X-Vault-Token", vc.currentToken())
			if resp, err := http.DefaultClient.Do(req); err == nil {
				resp.Body.Close()
			}
		}
	}
}

// Close cancels the renewal goroutine, revokes the Vault token, and zeros credentials.
func (vc *VaultClient) Close() error {
	vc.cancel()
	req, _ := http.NewRequest(http.MethodPost, vc.addr+"/v1/auth/token/revoke-self", nil)
	var tok string
	vc.mu.Lock()
	tok, vc.token = vc.token, ""
	vc.mu.Unlock()
	req.Header.Set("X-Vault-Token", tok)
	if resp, err := http.DefaultClient.Do(req); err == nil {
		resp.Body.Close()
	}
	return nil
}

// Policies returns the token's attached policy list via lookup-self.
func (vc *VaultClient) Policies(ctx context.Context) ([]string, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, vc.addr+"/v1/auth/token/lookup-self", nil)
	req.Header.Set("X-Vault-Token", vc.currentToken())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var info struct {
		Data struct {
			Policies []string `json:"policies"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&info) //nolint:errcheck
	return info.Data.Policies, nil
}
