package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// newWebhookHandlers creates a Handlers instance for inbound webhook tests.
// webhookSecret is wired into BOTH the GitHub App webhook secret and the
// GitLab webhook shared-token field — call sites already pass an empty
// string when they want fail-closed semantics.
func newWebhookHandlers(t *testing.T, webhookSecret string) *Handlers {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("storage.NewInMemory: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	logger, _ := logging.New(&logging.Config{Level: "error"})
	mgr := integrations.NewManager(logger)

	cfg := &config.Config{}
	cfg.Auth.GitHubApp.WebhookSecret = webhookSecret
	cfg.Auth.GitLabWebhookSecret = webhookSecret

	return New(db, mgr, nil, nil, logger, nil, cfg)
}

// signGitHub computes the X-Hub-Signature-256 value for the given body and secret.
func signGitHub(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// seedGitHubConn inserts a github connection directly into the DB.
func seedGitHubConn(t *testing.T, h *Handlers, name string) {
	t.Helper()
	if err := h.db.Create(&storage.ConnectionRecord{
		Name: name, Platform: "github", HealthStatus: "ok",
	}); err != nil {
		t.Fatalf("db.Create: %v", err)
	}
}

// seedGitLabConn inserts a gitlab connection directly into the DB.
func seedGitLabConn(t *testing.T, h *Handlers, name, token string) {
	t.Helper()
	if err := h.db.Create(&storage.ConnectionRecord{
		Name: name, Platform: "gitlab", Token: token, HealthStatus: "ok",
	}); err != nil {
		t.Fatalf("db.Create: %v", err)
	}
}

func TestGitHubWebhookPushEvent(t *testing.T) {
	const secret = "supersecret"
	h := newWebhookHandlers(t, secret)
	seedGitHubConn(t, h, "gh-main")

	payload := GitHubPushPayload{Ref: "refs/heads/main"}
	payload.Repository.FullName = "acme/repo"
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", bytes.NewReader(body))
	req.Header.Set("X-GitHub-Event", "push")
	req.Header.Set("X-Hub-Signature-256", signGitHub(body, secret))

	w := httptest.NewRecorder()
	h.InboundGitHubWebhook(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["status"] != "queued" {
		t.Errorf("expected status=queued, got %v", resp["status"])
	}
	if int(resp["connections"].(float64)) != 1 {
		t.Errorf("expected connections=1, got %v", resp["connections"])
	}
	if h.AutoScanQueue.Len() != 1 {
		t.Errorf("expected 1 queued job, got %d", h.AutoScanQueue.Len())
	}
}

func TestGitHubWebhookInvalidSignature(t *testing.T) {
	const secret = "supersecret"
	h := newWebhookHandlers(t, secret)

	payload := GitHubPushPayload{Ref: "refs/heads/main"}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", bytes.NewReader(body))
	req.Header.Set("X-GitHub-Event", "push")
	req.Header.Set("X-Hub-Signature-256", "sha256=badhash")

	w := httptest.NewRecorder()
	h.InboundGitHubWebhook(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGitHubWebhookUnknownEvent(t *testing.T) {
	h := newWebhookHandlers(t, "")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("X-GitHub-Event", "star")

	w := httptest.NewRecorder()
	h.InboundGitHubWebhook(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Code)
	}
}

func TestGitLabWebhookPushHook(t *testing.T) {
	const secret = "shared-gitlab-secret"
	h := newWebhookHandlers(t, secret)
	seedGitLabConn(t, h, "gl-main", "gltoken")

	payload := GitLabPushPayload{Ref: "refs/heads/main"}
	payload.Project.PathWithNamespace = "acme/repo"
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/gitlab", bytes.NewReader(body))
	req.Header.Set("X-Gitlab-Event", "Push Hook")
	req.Header.Set("X-Gitlab-Token", secret)

	w := httptest.NewRecorder()
	h.InboundGitLabWebhook(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["status"] != "queued" {
		t.Errorf("expected status=queued, got %v", resp["status"])
	}
	if int(resp["connections"].(float64)) != 1 {
		t.Errorf("expected connections=1, got %v", resp["connections"])
	}
}

func TestGitLabWebhook_FailClosedWhenSecretUnset(t *testing.T) {
	h := newWebhookHandlers(t, "")
	seedGitLabConn(t, h, "gl-main", "gltoken")

	payload := GitLabPushPayload{Ref: "refs/heads/main"}
	payload.Project.PathWithNamespace = "acme/repo"
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/gitlab", bytes.NewReader(body))
	req.Header.Set("X-Gitlab-Event", "Push Hook")
	req.Header.Set("X-Gitlab-Token", "anything")

	w := httptest.NewRecorder()
	h.InboundGitLabWebhook(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 fail-closed when secret unset, got %d", w.Code)
	}
}

func TestGitLabWebhook_RejectsTokenMismatch(t *testing.T) {
	h := newWebhookHandlers(t, "expected-secret")
	seedGitLabConn(t, h, "gl-main", "gltoken")

	payload := GitLabPushPayload{Ref: "refs/heads/main"}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/gitlab", bytes.NewReader(body))
	req.Header.Set("X-Gitlab-Event", "Push Hook")
	req.Header.Set("X-Gitlab-Token", "wrong-secret")

	w := httptest.NewRecorder()
	h.InboundGitLabWebhook(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 on token mismatch, got %d", w.Code)
	}
}

func TestGitLabWebhook_RejectsMissingHeader(t *testing.T) {
	h := newWebhookHandlers(t, "expected-secret")
	seedGitLabConn(t, h, "gl-main", "gltoken")

	payload := GitLabPushPayload{Ref: "refs/heads/main"}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/gitlab", bytes.NewReader(body))
	req.Header.Set("X-Gitlab-Event", "Push Hook")
	// no X-Gitlab-Token

	w := httptest.NewRecorder()
	h.InboundGitLabWebhook(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with missing header, got %d", w.Code)
	}
}

func TestAutoScanQueueEnqueueDrain(t *testing.T) {
	q := NewAutoScanQueue()

	jobs := []AutoScanJob{
		{ConnectionName: "a", Repo: "r1", TriggeredBy: "github_push", QueuedAt: time.Now()},
		{ConnectionName: "b", Repo: "r2", TriggeredBy: "gitlab_push", QueuedAt: time.Now()},
		{ConnectionName: "c", Repo: "r3", TriggeredBy: "github_pr", QueuedAt: time.Now()},
	}

	for _, j := range jobs {
		q.Enqueue(j)
	}

	if q.Len() != 3 {
		t.Fatalf("expected Len()=3, got %d", q.Len())
	}

	drained := q.Drain()

	if len(drained) != 3 {
		t.Fatalf("expected 3 drained jobs, got %d", len(drained))
	}
	if q.Len() != 0 {
		t.Fatalf("expected queue empty after drain, got %d", q.Len())
	}

	for i, j := range jobs {
		if drained[i].ConnectionName != j.ConnectionName {
			t.Errorf("job[%d] ConnectionName mismatch: got %s, want %s", i, drained[i].ConnectionName, j.ConnectionName)
		}
		if drained[i].TriggeredBy != j.TriggeredBy {
			t.Errorf("job[%d] TriggeredBy mismatch: got %s, want %s", i, drained[i].TriggeredBy, j.TriggeredBy)
		}
	}
}
