package platform

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// Bitbucket implements Provider for Bitbucket Cloud.
type Bitbucket struct {
	Username string
	AppPass  string // app password
}

func (b *Bitbucket) ParseWebhook(r *http.Request) (*Event, error) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	eventType := r.Header.Get("X-Event-Key")
	return parseBitbucketPayload(eventType, raw), nil
}

func parseBitbucketPayload(eventType string, raw map[string]interface{}) *Event {
	e := &Event{Provider: "bitbucket"}
	repo, _ := raw["repository"].(map[string]interface{})
	if repo != nil {
		e.Repo = str(repo["full_name"])
	}
	actor, _ := raw["actor"].(map[string]interface{})
	if actor != nil {
		e.Sender = str(actor["display_name"])
	}

	switch eventType {
	case "repo:push":
		e.Action = "push"
		push, _ := raw["push"].(map[string]interface{})
		if push != nil {
			changes, _ := push["changes"].([]interface{})
			if len(changes) > 0 {
				c, _ := changes[0].(map[string]interface{})
				if nw, ok := c["new"].(map[string]interface{}); ok {
					e.Branch = str(nw["name"])
					tgt, _ := nw["target"].(map[string]interface{})
					if tgt != nil {
						e.SHA = str(tgt["hash"])
					}
				}
			}
		}
	case "pullrequest:created", "pullrequest:updated":
		e.Action = "pull_request"
		pr, _ := raw["pullrequest"].(map[string]interface{})
		if pr != nil {
			e.PRNumber = intVal(pr["id"])
			src, _ := pr["source"].(map[string]interface{})
			if src != nil {
				br, _ := src["branch"].(map[string]interface{})
				if br != nil {
					e.Branch = str(br["name"])
				}
				commit, _ := src["commit"].(map[string]interface{})
				if commit != nil {
					e.SHA = str(commit["hash"])
				}
			}
		}
	}
	return e
}

func (b *Bitbucket) PostStatus(ctx context.Context, event *Event, s *Status) error {
	url := fmt.Sprintf(
		"https://api.bitbucket.org/2.0/repositories/%s/commit/%s/statuses/build",
		event.Repo, s.SHA,
	)
	payload := map[string]string{
		"state": mapBBState(s.State), "key": s.Context,
		"description": s.Description, "url": s.TargetURL,
	}
	return b.apiPost(ctx, url, payload)
}

