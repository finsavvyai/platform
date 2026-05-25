// REAL — uses github.com/hashicorp/vault/api.
// Add to go.mod via:
//   cd services/gateway && go get github.com/hashicorp/vault/api@latest && go mod tidy
//
// VaultCertSource issues a fresh client certificate from a Vault PKI
// mount on every Fetch. The Rotator drives Fetch on a timer; this
// file just owns the Vault HTTP wiring and PEM parsing.
//
// Auth modes:
//  - Static token: NewVaultCertSource(addr, token, ...) when token != "".
//  - AppRole:      VAULT_APPROLE_ID + VAULT_APPROLE_SECRET_ID env vars.
// AppRole is preferred in production; static tokens are fine for dev.
package mtls

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	vaultapi "github.com/hashicorp/vault/api"
)

// VaultCertSource issues new client certs from a Vault PKI mount.
type VaultCertSource struct {
	Address    string
	Token      string
	Mount      string
	Role       string
	CommonName string
	TTL        time.Duration

	client *vaultapi.Client
}

// NewVaultCertSource constructs a real Vault-backed cert source. It
// authenticates either via static token or AppRole (env-driven), and
// returns a usable client ready for Fetch.
func NewVaultCertSource(addr, token, mountPath, role, commonName string, ttl time.Duration) (*VaultCertSource, error) {
	if addr == "" {
		return nil, errors.New("mtls/vault: addr is required")
	}
	if mountPath == "" || role == "" {
		return nil, errors.New("mtls/vault: mountPath and role are required")
	}
	if commonName == "" {
		return nil, errors.New("mtls/vault: commonName is required")
	}
	cfg := vaultapi.DefaultConfig()
	cfg.Address = addr
	client, err := vaultapi.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("mtls/vault: new client: %w", err)
	}

	roleID, secretID := os.Getenv("VAULT_APPROLE_ID"), os.Getenv("VAULT_APPROLE_SECRET_ID")
	switch {
	case roleID != "" && secretID != "":
		// AppRole login.
		secret, err := client.Logical().Write("auth/approle/login", map[string]interface{}{
			"role_id":   roleID,
			"secret_id": secretID,
		})
		if err != nil {
			return nil, fmt.Errorf("mtls/vault: approle login: %w", err)
		}
		if secret == nil || secret.Auth == nil || secret.Auth.ClientToken == "" {
			return nil, errors.New("mtls/vault: approle login returned no token")
		}
		client.SetToken(secret.Auth.ClientToken)
	case token != "":
		client.SetToken(token)
	default:
		return nil, errors.New("mtls/vault: no auth: pass token or set VAULT_APPROLE_ID/VAULT_APPROLE_SECRET_ID")
	}

	return &VaultCertSource{
		Address:    addr,
		Token:      token,
		Mount:      strings.Trim(mountPath, "/"),
		Role:       role,
		CommonName: commonName,
		TTL:        ttl,
		client:     client,
	}, nil
}

// Name implements CertSource.
func (v *VaultCertSource) Name() string { return "vault:" + v.Mount + "/" + v.Role }

// Fetch issues a new cert from Vault and returns it as a tls.Certificate.
func (v *VaultCertSource) Fetch(ctx context.Context) (*tls.Certificate, error) {
	if v.client == nil {
		return nil, errors.New("mtls/vault: nil client (use NewVaultCertSource)")
	}
	ttl := v.TTL
	if ttl <= 0 {
		ttl = time.Hour
	}
	path := fmt.Sprintf("%s/issue/%s", v.Mount, v.Role)
	secret, err := v.client.Logical().WriteWithContext(ctx, path, map[string]interface{}{
		"common_name": v.CommonName,
		"ttl":         ttl.String(),
	})
	if err != nil {
		return nil, fmt.Errorf("mtls/vault: issue %s: %w", path, err)
	}
	if secret == nil || secret.Data == nil {
		return nil, errors.New("mtls/vault: empty response from PKI issue")
	}
	certPEM, err := stringField(secret.Data, "certificate")
	if err != nil {
		return nil, err
	}
	keyPEM, err := stringField(secret.Data, "private_key")
	if err != nil {
		return nil, err
	}
	chainPEM := concatChain(secret.Data["ca_chain"])
	full := []byte(certPEM)
	if chainPEM != "" {
		full = append(full, '\n')
		full = append(full, chainPEM...)
	}
	cert, err := tls.X509KeyPair(full, []byte(keyPEM))
	if err != nil {
		return nil, fmt.Errorf("mtls/vault: parse PEM: %w", err)
	}
	return &cert, nil
}

func stringField(data map[string]interface{}, key string) (string, error) {
	raw, ok := data[key]
	if !ok {
		return "", fmt.Errorf("mtls/vault: missing %q in PKI response", key)
	}
	s, ok := raw.(string)
	if !ok || s == "" {
		return "", fmt.Errorf("mtls/vault: %q not a non-empty string", key)
	}
	return s, nil
}

func concatChain(raw interface{}) string {
	if raw == nil {
		return ""
	}
	arr, ok := raw.([]interface{})
	if !ok {
		return ""
	}
	parts := make([]string, 0, len(arr))
	for _, p := range arr {
		if s, ok := p.(string); ok && s != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, "\n")
}
