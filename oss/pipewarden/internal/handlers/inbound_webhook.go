package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

// InboundGitHubWebhook handles POST /api/v1/webhooks/github.
// It verifies the HMAC-SHA256 signature, filters push and pull_request events,
// and enqueues an auto-scan job for every matching connection.
func (h *Handlers) InboundGitHubWebhook(w http.ResponseWriter, r *http.Request) {
	event := r.Header.Get("X-GitHub-Event")
	if event != "push" && event != "pull_request" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		jsonError(w, "failed to read body", http.StatusBadRequest)
		return
	}

	if !verifyGitHubSignature(body, r.Header.Get("X-Hub-Signature-256"), h.githubWebhookSecret()) {
		jsonError(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	repo, trigger := parseGitHubPayload(event, body)

	connections, err := h.db.List()
	if err != nil {
		jsonError(w, "failed to list connections", http.StatusInternalServerError)
		return
	}

	count := 0
	for _, c := range connections {
		if strings.EqualFold(c.Platform, "github") {
			h.AutoScanQueue.Enqueue(AutoScanJob{
				ConnectionName: c.Name,
				Repo:           repo,
				TriggeredBy:    trigger,
				QueuedAt:       time.Now().UTC(),
			})
			count++
		}
	}

	jsonOK(w, map[string]interface{}{"status": "queued", "connections": count})
}

// InboundGitLabWebhook handles POST /api/v1/webhooks/gitlab.
// Fails closed: refuses every event when GITLAB_WEBHOOK_SECRET is unset.
// When set, the X-Gitlab-Token header is constant-time-compared to the
// configured secret. On success enqueues an auto-scan for every gitlab
// connection.
func (h *Handlers) InboundGitLabWebhook(w http.ResponseWriter, r *http.Request) {
	event := r.Header.Get("X-Gitlab-Event")
	if event != "Push Hook" && event != "Merge Request Hook" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	secret := h.gitlabWebhookSecret()
	if secret == "" {
		jsonError(w, "gitlab webhook secret not configured", http.StatusUnauthorized)
		return
	}

	incomingToken := r.Header.Get("X-Gitlab-Token")
	if !verifyGitLabToken(incomingToken, secret) {
		jsonError(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		jsonError(w, "failed to read body", http.StatusBadRequest)
		return
	}

	repo, trigger := parseGitLabPayload(event, body)

	connections, err := h.db.List()
	if err != nil {
		jsonError(w, "failed to list connections", http.StatusInternalServerError)
		return
	}

	count := 0
	for _, c := range connections {
		if !strings.EqualFold(c.Platform, "gitlab") {
			continue
		}
		h.AutoScanQueue.Enqueue(AutoScanJob{
			ConnectionName: c.Name,
			Repo:           repo,
			TriggeredBy:    trigger,
			QueuedAt:       time.Now().UTC(),
		})
		count++
	}

	jsonOK(w, map[string]interface{}{"status": "queued", "connections": count})
}

// gitlabWebhookSecret returns the configured GitLab webhook shared secret.
func (h *Handlers) gitlabWebhookSecret() string {
	if h.cfg != nil {
		return h.cfg.Auth.GitLabWebhookSecret
	}
	return ""
}

// verifyGitLabToken constant-time-compares the inbound X-Gitlab-Token to
// the configured shared secret. Returns false when either side is empty.
func verifyGitLabToken(incoming, secret string) bool {
	if incoming == "" || secret == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(incoming), []byte(secret)) == 1
}

// githubWebhookSecret returns the configured GitHub webhook secret, if any.
func (h *Handlers) githubWebhookSecret() string {
	if h.cfg != nil {
		return h.cfg.Auth.GitHubApp.WebhookSecret
	}
	return ""
}

// verifyGitHubSignature validates the X-Hub-Signature-256 header.
// Returns true when no secret is configured (open mode) or when MAC matches.
func verifyGitHubSignature(body []byte, sigHeader, secret string) bool {
	if secret == "" {
		return true
	}
	if !strings.HasPrefix(sigHeader, "sha256=") {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sigHeader))
}

// parseGitHubPayload extracts repo full name and trigger label from a push or PR body.
func parseGitHubPayload(event string, body []byte) (repo, trigger string) {
	if event == "push" {
		var p GitHubPushPayload
		_ = json.Unmarshal(body, &p)
		return p.Repository.FullName, "github_push"
	}
	var p GitHubPRPayload
	_ = json.Unmarshal(body, &p)
	return p.Repository.FullName, "github_pr"
}

// parseGitLabPayload extracts repo path and trigger label from a push or MR body.
func parseGitLabPayload(event string, body []byte) (repo, trigger string) {
	if event == "Push Hook" {
		var p GitLabPushPayload
		_ = json.Unmarshal(body, &p)
		return p.Project.PathWithNamespace, "gitlab_push"
	}
	var p GitLabMRPayload
	_ = json.Unmarshal(body, &p)
	return p.Project.PathWithNamespace, "gitlab_mr"
}
