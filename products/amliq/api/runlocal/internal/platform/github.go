package platform

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// GitHub implements Provider for GitHub webhooks and API.
type GitHub struct {
	Token         string
	WebhookSecret string
}

func (g *GitHub) ParseWebhook(r *http.Request) (*Event, error) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	if err := g.verifySignature(body, r.Header.Get("X-Hub-Signature-256")); err != nil {
		return nil, err
	}
	eventType := r.Header.Get("X-GitHub-Event")
	return g.parseEvent(eventType, body)
}

func (g *GitHub) verifySignature(body []byte, sig string) error {
	if g.WebhookSecret == "" {
		return nil // skip if secret not configured (local dev only)
	}
	if sig == "" {
		return fmt.Errorf("missing webhook signature")
	}
	mac := hmac.New(sha256.New, []byte(g.WebhookSecret))
	mac.Write(body)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(sig)) {
		return fmt.Errorf("invalid webhook signature")
	}
	return nil
}

func (g *GitHub) parseEvent(eventType string, body []byte) (*Event, error) {
	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	return parseGitHubPayload(eventType, raw), nil
}

func (g *GitHub) PostStatus(ctx context.Context, event *Event, s *Status) error {
	url := fmt.Sprintf(
		"https://api.github.com/repos/%s/statuses/%s", event.Repo, s.SHA,
	)
	payload := map[string]string{
		"state": string(s.State), "context": s.Context,
		"description": s.Description, "target_url": s.TargetURL,
	}
	return g.apiPost(ctx, url, payload)
}

func (g *GitHub) PostComment(ctx context.Context, event *Event, body string) error {
	if event.PRNumber == 0 {
		return nil
	}
	url := fmt.Sprintf(
		"https://api.github.com/repos/%s/issues/%d/comments",
		event.Repo, event.PRNumber,
	)
	return g.apiPost(ctx, url, map[string]string{"body": body})
}

func (g *GitHub) apiPost(ctx context.Context, url string, payload interface{}) error {
	data, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	req.Header.Set("Authorization", "Bearer "+g.Token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("github api %d: %s", resp.StatusCode, b)
	}
	return nil
}
