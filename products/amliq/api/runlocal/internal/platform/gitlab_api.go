package platform

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func (g *GitLab) PostComment(ctx context.Context, event *Event, body string) error {
	if event.PRNumber == 0 {
		return nil
	}
	url := fmt.Sprintf(
		"%s/api/v4/projects/%s/merge_requests/%d/notes",
		g.apiBase(), event.Repo, event.PRNumber,
	)
	return g.apiPost(ctx, url, map[string]string{"body": body})
}

func (g *GitLab) apiPost(ctx context.Context, url string, payload interface{}) error {
	data, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	req.Header.Set("PRIVATE-TOKEN", g.Token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("gitlab api %d: %s", resp.StatusCode, b)
	}
	return nil
}
