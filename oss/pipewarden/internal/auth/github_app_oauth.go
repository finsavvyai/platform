package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// VerifyWebhookSignature verifies GitHub webhook X-Hub-Signature-256 header.
// Uses HMAC-SHA256 with the configured webhook secret.
func (g *GitHubApp) VerifyWebhookSignature(payload []byte, signature string) bool {
	if signature == "" || g.WebhookSecret == "" {
		return false
	}

	h := hmac.New(sha256.New, []byte(g.WebhookSecret))
	h.Write(payload)
	digest := h.Sum(nil)
	expected := "sha256=" + fmt.Sprintf("%x", digest)

	return hmac.Equal([]byte(expected), []byte(signature))
}

// HandleCallback processes GitHub OAuth callback after app installation.
// Extracts installation_id from URL parameters.
func (g *GitHubApp) HandleCallback(r *http.Request) (int64, error) {
	if err := r.ParseForm(); err != nil {
		return 0, fmt.Errorf("failed to parse form: %w", err)
	}

	installationID := r.FormValue("installation_id")
	if installationID == "" {
		return 0, fmt.Errorf("missing installation_id parameter")
	}

	var id int64
	if _, err := fmt.Sscanf(installationID, "%d", &id); err != nil {
		return 0, fmt.Errorf("invalid installation_id: %w", err)
	}

	return id, nil
}

// ListInstallations retrieves all GitHub App installations using JWT auth.
func (g *GitHubApp) ListInstallations(httpClient *http.Client) ([]Installation, error) {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}

	jwtToken, err := g.GenerateJWT()
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT: %w", err)
	}

	req, err := http.NewRequest(http.MethodGet, g.apiBaseURL()+"/app/installations", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list installations: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github API error (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var installations []Installation
	if err := json.NewDecoder(resp.Body).Decode(&installations); err != nil {
		return nil, fmt.Errorf("failed to decode installations: %w", err)
	}

	return installations, nil
}

// GenerateState creates a CSRF protection state string (URL-safe base64, 16-byte random).
func GenerateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate state: %w", err)
	}
	return base64.URLEncoding.EncodeToString(b), nil
}
