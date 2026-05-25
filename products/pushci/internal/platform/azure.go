package platform

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// Azure implements Provider for Azure DevOps Services.
//
// Auth model: Azure DevOps service hooks do not sign payloads with an
// HMAC. Instead, the hook is configured with HTTP Basic auth — the
// configured username/password pair appears in the incoming request's
// Authorization header. We verify the shared credential on the way in
// and reuse the same PAT for outgoing API calls (status + PR comments).
//
// Required org-scoped PAT permissions: Code (Status: write) and, for
// PR comments, Code (PullRequest Threads: write).
type Azure struct {
	Organization  string // e.g. "finsavvyai" → https://dev.azure.com/finsavvyai
	PAT           string // personal access token for REST calls (basic auth, empty user)
	WebhookUser   string // expected inbound basic-auth user (optional)
	WebhookSecret string // expected inbound basic-auth password (optional)
}

func (a *Azure) ParseWebhook(r *http.Request) (*Event, error) {
	if err := a.verifyBasicAuth(r); err != nil {
		return nil, err
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	return parseAzurePayload(raw), nil
}

// verifyBasicAuth checks inbound Authorization header matches configured
// credentials. When no secret is set we skip verification — local dev
// only. Azure DevOps stores these at hook-creation time in the portal.
func (a *Azure) verifyBasicAuth(r *http.Request) error {
	if a.WebhookSecret == "" {
		return nil
	}
	u, p, ok := r.BasicAuth()
	if !ok {
		return fmt.Errorf("missing basic auth")
	}
	if u != a.WebhookUser || p != a.WebhookSecret {
		return fmt.Errorf("invalid basic auth")
	}
	return nil
}

func mapAzureState(s State) string {
	switch s {
	case StateSuccess:
		return "succeeded"
	case StateFailure:
		return "failed"
	case StatePending:
		return "pending"
	case StateError:
		return "error"
	default:
		return "error"
	}
}
