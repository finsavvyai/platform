package platform

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// splitAzureRepo splits "{project}/{repositoryId}" back into its two
// components. Returns ("", "") when the shape is unexpected — the API
// helpers short-circuit and return nil in that case rather than posting
// to a malformed URL.
func splitAzureRepo(repo string) (project, repoID string) {
	i := strings.Index(repo, "/")
	if i < 0 {
		return "", ""
	}
	return repo[:i], repo[i+1:]
}

func (a *Azure) PostStatus(ctx context.Context, event *Event, s *Status) error {
	project, repoID := splitAzureRepo(event.Repo)
	if project == "" || repoID == "" || a.Organization == "" {
		return nil
	}
	url := fmt.Sprintf(
		"https://dev.azure.com/%s/%s/_apis/git/repositories/%s/commits/%s/statuses?api-version=7.0",
		a.Organization, project, repoID, s.SHA,
	)
	payload := map[string]interface{}{
		"state":       mapAzureState(s.State),
		"description": s.Description,
		"targetUrl":   s.TargetURL,
		"context":     map[string]string{"genre": "pushci", "name": s.Context},
	}
	return a.apiSend(ctx, "POST", url, payload)
}

func (a *Azure) PostComment(ctx context.Context, event *Event, body string) error {
	if event.PRNumber == 0 {
		return nil
	}
	project, repoID := splitAzureRepo(event.Repo)
	if project == "" || repoID == "" || a.Organization == "" {
		return nil
	}
	url := fmt.Sprintf(
		"https://dev.azure.com/%s/%s/_apis/git/repositories/%s/pullRequests/%d/threads?api-version=7.0",
		a.Organization, project, repoID, event.PRNumber,
	)
	payload := map[string]interface{}{
		"comments": []map[string]interface{}{
			{"parentCommentId": 0, "content": body, "commentType": 1},
		},
		"status": 1,
	}
	return a.apiSend(ctx, "POST", url, payload)
}

func (a *Azure) apiSend(ctx context.Context, method, url string, payload interface{}) error {
	data, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(data))
	// Azure DevOps PATs use basic auth with empty username.
	req.SetBasicAuth("", a.PAT)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("azure devops api %d: %s", resp.StatusCode, b)
	}
	return nil
}
