package platform

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func mapBBState(s State) string {
	switch s {
	case StateSuccess:
		return "SUCCESSFUL"
	case StateFailure:
		return "FAILED"
	case StatePending:
		return "INPROGRESS"
	default:
		return "FAILED"
	}
}

func (b *Bitbucket) PostComment(ctx context.Context, event *Event, body string) error {
	if event.PRNumber == 0 {
		return nil
	}
	url := fmt.Sprintf(
		"https://api.bitbucket.org/2.0/repositories/%s/pullrequests/%d/comments",
		event.Repo, event.PRNumber,
	)
	return b.apiPost(ctx, url, map[string]interface{}{
		"content": map[string]string{"raw": body},
	})
}

func (b *Bitbucket) apiPost(ctx context.Context, url string, payload interface{}) error {
	data, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	req.SetBasicAuth(b.Username, b.AppPass)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("bitbucket api %d: %s", resp.StatusCode, body)
	}
	return nil
}
