package platform

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// GitLab implements Provider for GitLab webhooks and API.
type GitLab struct {
	Token         string
	WebhookSecret string
	BaseURL       string
}

func (g *GitLab) apiBase() string {
	if g.BaseURL != "" {
		return g.BaseURL
	}
	return "https://gitlab.com"
}

func (g *GitLab) ParseWebhook(r *http.Request) (*Event, error) {
	if g.WebhookSecret != "" {
		if r.Header.Get("X-Gitlab-Token") != g.WebhookSecret {
			return nil, fmt.Errorf("invalid gitlab webhook token")
		}
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	return parseGitLabPayload(raw), nil
}

func (g *GitLab) PostStatus(ctx context.Context, event *Event, s *Status) error {
	url := fmt.Sprintf(
		"%s/api/v4/projects/%s/statuses/%s",
		g.apiBase(), event.Repo, s.SHA,
	)
	payload := map[string]string{
		"state": mapGitLabState(s.State), "name": s.Context,
		"description": s.Description, "target_url": s.TargetURL,
	}
	return g.apiPost(ctx, url, payload)
}

func mapGitLabState(s State) string {
	switch s {
	case StateSuccess:
		return "success"
	case StateFailure:
		return "failed"
	case StatePending:
		return "pending"
	default:
		return "failed"
	}
}
