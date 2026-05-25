package platform

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

// CircleCI implements Provider for CircleCI v2 webhooks.
//
// CircleCI emits signed JSON webhooks for "workflow-completed" and
// "job-completed" events. Unlike GitHub/GitLab/Bitbucket, CircleCI
// has no "post commit status" API — it pushes statuses to the
// attached VCS (GitHub/Bitbucket) directly. For the Provider
// interface, PostStatus and PostComment no-op with a clear log.
// If you need commit statuses back to the VCS, register the
// underlying VCS provider and route based on event.Provider.
type CircleCI struct {
	WebhookSecret string // 32+ byte shared secret from CircleCI project webhook config
}

func (c *CircleCI) ParseWebhook(r *http.Request) (*Event, error) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	if err := c.verifySignature(body, r.Header.Get("circleci-signature")); err != nil {
		return nil, err
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	return parseCircleCIPayload(raw), nil
}

func (c *CircleCI) PostStatus(_ context.Context, event *Event, s *Status) error {
	log.Printf("[circleci] PostStatus noop repo=%s sha=%s state=%s (CircleCI posts status to VCS directly)",
		event.Repo, s.SHA, s.State)
	return nil
}

func (c *CircleCI) PostComment(_ context.Context, event *Event, _ string) error {
	log.Printf("[circleci] PostComment noop repo=%s PR=%d (CircleCI has no comment API)",
		event.Repo, event.PRNumber)
	return nil
}
