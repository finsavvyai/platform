package platform

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// ── shared helpers ────────────────────────────────────────────────────────────

type captured struct {
	method  string
	path    string
	body    map[string]interface{}
	headers http.Header
}

func mockServer(t *testing.T, statusCode int) (*httptest.Server, *captured) {
	t.Helper()
	cap := &captured{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cap.method = r.Method
		cap.path = r.URL.Path
		cap.headers = r.Header.Clone()
		b, _ := io.ReadAll(r.Body)
		json.Unmarshal(b, &cap.body)
		w.WriteHeader(statusCode)
		w.Write([]byte(`{}`))
	}))
	t.Cleanup(srv.Close)
	return srv, cap
}

func testEvent(sha string, prNum int) *Event {
	return &Event{Repo: "owner/repo", SHA: sha, PRNumber: prNum}
}

func testStatus(sha string, state State) *Status {
	return &Status{
		SHA: sha, State: state,
		Context: "pushci/ci", Description: "Pipeline passed",
		TargetURL: "https://app.pushci.dev/run/123",
	}
}

// ── GitHub PostStatus ─────────────────────────────────────────────────────────

func TestGitHub_PostStatus_Success(t *testing.T) {
	srv, cap := mockServer(t, 201)

	gh := &GitHub{Token: "test-token"}
	// Override the URL by patching through a helper — we test via apiPost directly
	// with a redirected http.DefaultClient; instead we use a sub-test server approach.
	_ = cap

	// Real test: build a fake GitHub API and confirm the request shape.
	ctx := context.Background()
	event := testEvent("abc123", 0)
	status := testStatus("abc123", StateSuccess)

	// Swap DefaultClient transport to route to test server.
	orig := http.DefaultTransport
	http.DefaultTransport = &redirectTransport{base: srv.URL, real: orig}
	t.Cleanup(func() { http.DefaultTransport = orig })

	err := gh.PostStatus(ctx, event, status)
	if err != nil {
		t.Fatalf("PostStatus error: %v", err)
	}
	if cap.method != "POST" {
		t.Errorf("method = %q, want POST", cap.method)
	}
	if cap.body["state"] != "success" {
		t.Errorf("state = %v, want success", cap.body["state"])
	}
	if cap.body["context"] != "pushci/ci" {
		t.Errorf("context = %v, want pushci/ci", cap.body["context"])
	}
	if cap.headers.Get("Authorization") != "Bearer test-token" {
		t.Errorf("auth header = %q", cap.headers.Get("Authorization"))
	}
}

func TestGitHub_PostStatus_AllStates(t *testing.T) {
	states := []State{StatePending, StateSuccess, StateFailure, StateError}
	for _, state := range states {
		t.Run(string(state), func(t *testing.T) {
			srv, cap := mockServer(t, 201)
			orig := http.DefaultTransport
			http.DefaultTransport = &redirectTransport{base: srv.URL, real: orig}
			t.Cleanup(func() { http.DefaultTransport = orig })

			gh := &GitHub{Token: "tok"}
			err := gh.PostStatus(context.Background(), testEvent("sha1", 0), testStatus("sha1", state))
			if err != nil {
				t.Fatalf("PostStatus(%s) error: %v", state, err)
			}
			if cap.body["state"] != string(state) {
				t.Errorf("state = %v, want %s", cap.body["state"], state)
			}
		})
	}
}

func TestGitHub_PostStatus_APIError(t *testing.T) {
	srv, _ := mockServer(t, 422)
	orig := http.DefaultTransport
	http.DefaultTransport = &redirectTransport{base: srv.URL, real: orig}
	t.Cleanup(func() { http.DefaultTransport = orig })

	gh := &GitHub{Token: "tok"}
	err := gh.PostStatus(context.Background(), testEvent("sha1", 0), testStatus("sha1", StateSuccess))
	if err == nil {
		t.Error("expected error for 422 response")
	}
}

// ── GitHub PostComment ────────────────────────────────────────────────────────

func TestGitHub_PostComment_OnPR(t *testing.T) {
	srv, cap := mockServer(t, 201)
	orig := http.DefaultTransport
	http.DefaultTransport = &redirectTransport{base: srv.URL, real: orig}
	t.Cleanup(func() { http.DefaultTransport = orig })

	gh := &GitHub{Token: "tok"}
	err := gh.PostComment(context.Background(), testEvent("sha", 7), "Build passed!")
	if err != nil {
		t.Fatalf("PostComment error: %v", err)
	}
	if cap.body["body"] != "Build passed!" {
		t.Errorf("body = %v, want 'Build passed!'", cap.body["body"])
	}
}

func TestGitHub_PostComment_SkipsNonPR(t *testing.T) {
	// PRNumber == 0 must not make any HTTP call
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))
	t.Cleanup(srv.Close)

	orig := http.DefaultTransport
	http.DefaultTransport = &redirectTransport{base: srv.URL, real: orig}
	t.Cleanup(func() { http.DefaultTransport = orig })

	gh := &GitHub{Token: "tok"}
	_ = gh.PostComment(context.Background(), testEvent("sha", 0), "should not send")
	if called {
		t.Error("PostComment made HTTP call for non-PR event")
	}
}

// ── GitHub ParseWebhook edge cases ────────────────────────────────────────────

func TestGitHub_ParseWebhook_UnknownEvent(t *testing.T) {
	gh := &GitHub{}
	body := `{"repository":{"full_name":"a/b","clone_url":""},"sender":{"login":"x"}}`
	req, _ := http.NewRequest("POST", "/", stringReader(body))
	req.Header.Set("X-GitHub-Event", "ping")
	ev, err := gh.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// ping maps to empty action — provider still set
	if ev.Provider != "github" {
		t.Errorf("provider = %q, want github", ev.Provider)
	}
	if ev.Repo != "a/b" {
		t.Errorf("repo = %q, want a/b", ev.Repo)
	}
}

func TestGitHub_ParseWebhook_RefTooShort(t *testing.T) {
	gh := &GitHub{}
	body := `{"ref":"main","after":"sha1","repository":{"full_name":"a/b","clone_url":""},"sender":{"login":"x"}}`
	req, _ := http.NewRequest("POST", "/", stringReader(body))
	req.Header.Set("X-GitHub-Event", "push")
	ev, err := gh.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// ref shorter than 11 chars → Branch stays empty, no panic
	if ev.Branch != "" {
		t.Errorf("branch = %q, want empty for short ref", ev.Branch)
	}
}

func TestGitHub_ParseWebhook_NoSecret_SkipsVerify(t *testing.T) {
	gh := &GitHub{} // no WebhookSecret
	body := `{"ref":"refs/heads/main","after":"s","repository":{"full_name":"a/b","clone_url":""},"sender":{"login":"x"}}`
	req, _ := http.NewRequest("POST", "/", stringReader(body))
	req.Header.Set("X-GitHub-Event", "push")
	// No X-Hub-Signature-256 header — must succeed when no secret configured
	_, err := gh.ParseWebhook(req)
	if err != nil {
		t.Errorf("expected nil error with no secret, got %v", err)
	}
}

// ── GitLab PostStatus ─────────────────────────────────────────────────────────

func TestGitLab_PostStatus_Success(t *testing.T) {
	srv, cap := mockServer(t, 201)

	gl := &GitLab{Token: "gl-token", BaseURL: srv.URL}
	err := gl.PostStatus(context.Background(), testEvent("sha1", 0), testStatus("sha1", StateSuccess))
	if err != nil {
		t.Fatalf("PostStatus error: %v", err)
	}
	if cap.method != "POST" {
		t.Errorf("method = %q, want POST", cap.method)
	}
	if cap.body["state"] != "success" {
		t.Errorf("state = %v, want success", cap.body["state"])
	}
	if cap.headers.Get("PRIVATE-TOKEN") != "gl-token" {
		t.Errorf("PRIVATE-TOKEN header = %q", cap.headers.Get("PRIVATE-TOKEN"))
	}
}

func TestGitLab_PostStatus_StateMapping(t *testing.T) {
	cases := []struct {
		in   State
		want string
	}{
		{StateSuccess, "success"},
		{StateFailure, "failed"},
		{StatePending, "pending"},
		{StateError, "failed"},
	}
	for _, c := range cases {
		t.Run(string(c.in), func(t *testing.T) {
			srv, cap := mockServer(t, 201)
			gl := &GitLab{Token: "tok", BaseURL: srv.URL}
			gl.PostStatus(context.Background(), testEvent("s", 0), testStatus("s", c.in))
			if cap.body["state"] != c.want {
				t.Errorf("state = %v, want %s", cap.body["state"], c.want)
			}
		})
	}
}

func TestGitLab_PostStatus_DefaultBaseURL(t *testing.T) {
	gl := &GitLab{}
	if gl.apiBase() != "https://gitlab.com" {
		t.Errorf("apiBase() = %q, want https://gitlab.com", gl.apiBase())
	}
}

func TestGitLab_PostStatus_CustomBaseURL(t *testing.T) {
	gl := &GitLab{BaseURL: "https://gitlab.myco.com"}
	if gl.apiBase() != "https://gitlab.myco.com" {
		t.Errorf("apiBase() = %q, want https://gitlab.myco.com", gl.apiBase())
	}
}

func TestGitLab_PostStatus_APIError(t *testing.T) {
	srv, _ := mockServer(t, 401)
	gl := &GitLab{Token: "bad", BaseURL: srv.URL}
	err := gl.PostStatus(context.Background(), testEvent("sha", 0), testStatus("sha", StateSuccess))
	if err == nil {
		t.Error("expected error for 401 response")
	}
}

// ── GitLab PostComment ────────────────────────────────────────────────────────

func TestGitLab_PostComment_OnMR(t *testing.T) {
	srv, cap := mockServer(t, 201)
	gl := &GitLab{Token: "tok", BaseURL: srv.URL}
	err := gl.PostComment(context.Background(), testEvent("sha", 42), "MR comment text")
	if err != nil {
		t.Fatalf("PostComment error: %v", err)
	}
	if cap.body["body"] != "MR comment text" {
		t.Errorf("body = %v", cap.body["body"])
	}
}

func TestGitLab_PostComment_SkipsNonMR(t *testing.T) {
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { called = true }))
	t.Cleanup(srv.Close)
	gl := &GitLab{Token: "tok", BaseURL: srv.URL}
	_ = gl.PostComment(context.Background(), testEvent("sha", 0), "no-send")
	if called {
		t.Error("PostComment made HTTP call for non-MR event")
	}
}

// ── GitLab ParseWebhook edge cases ────────────────────────────────────────────

func TestGitLab_ParseWebhook_TagPush(t *testing.T) {
	gl := &GitLab{}
	body := `{"object_kind":"tag_push","ref":"refs/tags/v1.0.0","after":"tagsha",
		"project":{"path_with_namespace":"g/p","git_http_url":""},"user":{"username":"u"}}`
	req, _ := http.NewRequest("POST", "/", stringReader(body))
	ev, err := gl.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Provider != "gitlab" {
		t.Errorf("provider = %q, want gitlab", ev.Provider)
	}
	if ev.Repo != "g/p" {
		t.Errorf("repo = %q, want g/p", ev.Repo)
	}
}

func TestGitLab_ParseWebhook_MissingProject(t *testing.T) {
	gl := &GitLab{}
	body := `{"object_kind":"push","ref":"refs/heads/main","after":"s"}`
	req, _ := http.NewRequest("POST", "/", stringReader(body))
	ev, err := gl.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Repo != "" {
		t.Errorf("expected empty repo for missing project, got %q", ev.Repo)
	}
}

// ── Bitbucket PostStatus ──────────────────────────────────────────────────────

func TestBitbucket_PostStatus_Success(t *testing.T) {
	srv, cap := mockServer(t, 201)
	orig := http.DefaultTransport
	http.DefaultTransport = &redirectTransport{base: srv.URL, real: orig}
	t.Cleanup(func() { http.DefaultTransport = orig })

	bb := &Bitbucket{Username: "user", AppPass: "pass"}
	err := bb.PostStatus(context.Background(), testEvent("bb123", 0), testStatus("bb123", StateSuccess))
	if err != nil {
		t.Fatalf("PostStatus error: %v", err)
	}
	if cap.method != "POST" {
		t.Errorf("method = %q, want POST", cap.method)
	}
	if cap.body["state"] != "SUCCESSFUL" {
		t.Errorf("state = %v, want SUCCESSFUL", cap.body["state"])
	}
	if cap.body["key"] != "pushci/ci" {
		t.Errorf("key = %v, want pushci/ci", cap.body["key"])
	}
}

func TestBitbucket_PostStatus_StateMapping(t *testing.T) {
	cases := []struct {
		in   State
		want string
	}{
		{StateSuccess, "SUCCESSFUL"},
		{StateFailure, "FAILED"},
		{StatePending, "INPROGRESS"},
		{StateError, "FAILED"},
	}
	for _, c := range cases {
		t.Run(string(c.in), func(t *testing.T) {
			got := mapBBState(c.in)
			if got != c.want {
				t.Errorf("mapBBState(%s) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}

func TestBitbucket_PostStatus_APIError(t *testing.T) {
	srv, _ := mockServer(t, 403)
	orig := http.DefaultTransport
	http.DefaultTransport = &redirectTransport{base: srv.URL, real: orig}
	t.Cleanup(func() { http.DefaultTransport = orig })

	bb := &Bitbucket{Username: "u", AppPass: "p"}
	err := bb.PostStatus(context.Background(), testEvent("sha", 0), testStatus("sha", StateSuccess))
	if err == nil {
		t.Error("expected error for 403 response")
	}
}

// ── Bitbucket PostComment ─────────────────────────────────────────────────────

func TestBitbucket_PostComment_OnPR(t *testing.T) {
	srv, cap := mockServer(t, 201)
	orig := http.DefaultTransport
	http.DefaultTransport = &redirectTransport{base: srv.URL, real: orig}
	t.Cleanup(func() { http.DefaultTransport = orig })

	bb := &Bitbucket{Username: "u", AppPass: "p"}
	err := bb.PostComment(context.Background(), testEvent("sha", 5), "PR comment")
	if err != nil {
		t.Fatalf("PostComment error: %v", err)
	}
	content, _ := cap.body["content"].(map[string]interface{})
	if content == nil || content["raw"] != "PR comment" {
		t.Errorf("content.raw = %v, want 'PR comment'", content)
	}
}

func TestBitbucket_PostComment_SkipsNonPR(t *testing.T) {
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { called = true }))
	t.Cleanup(srv.Close)
	orig := http.DefaultTransport
	http.DefaultTransport = &redirectTransport{base: srv.URL, real: orig}
	t.Cleanup(func() { http.DefaultTransport = orig })

	bb := &Bitbucket{Username: "u", AppPass: "p"}
	_ = bb.PostComment(context.Background(), testEvent("sha", 0), "no-send")
	if called {
		t.Error("PostComment made HTTP call for non-PR event")
	}
}

// ── Bitbucket ParseWebhook edge cases ─────────────────────────────────────────

func TestBitbucket_ParseWebhook_UnknownEvent(t *testing.T) {
	body := `{"repository":{"full_name":"ws/repo"},"actor":{"display_name":"u"}}`
	req, _ := http.NewRequest("POST", "/", stringReader(body))
	req.Header.Set("X-Event-Key", "repo:fork")

	bb := &Bitbucket{}
	ev, err := bb.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Provider != "bitbucket" {
		t.Errorf("provider = %q, want bitbucket", ev.Provider)
	}
	if ev.Action != "" {
		t.Errorf("action = %q, want empty for unknown event", ev.Action)
	}
}

func TestBitbucket_ParseWebhook_EmptyChanges(t *testing.T) {
	body := `{"repository":{"full_name":"ws/repo"},"actor":{"display_name":"u"},"push":{"changes":[]}}`
	req, _ := http.NewRequest("POST", "/", stringReader(body))
	req.Header.Set("X-Event-Key", "repo:push")

	bb := &Bitbucket{}
	ev, err := bb.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// empty changes → no branch/sha, no panic
	if ev.Branch != "" {
		t.Errorf("branch = %q, want empty", ev.Branch)
	}
}

// ── Provider interface conformance ────────────────────────────────────────────

func TestProviderInterfaceConformance(t *testing.T) {
	// Compile-time check: each struct must satisfy Provider.
	var _ Provider = &GitHub{}
	var _ Provider = &GitLab{}
	var _ Provider = &Bitbucket{}
}

// ── State constants ───────────────────────────────────────────────────────────

func TestStateConstants(t *testing.T) {
	if StatePending != "pending" {
		t.Errorf("StatePending = %q", StatePending)
	}
	if StateSuccess != "success" {
		t.Errorf("StateSuccess = %q", StateSuccess)
	}
	if StateFailure != "failure" {
		t.Errorf("StateFailure = %q", StateFailure)
	}
	if StateError != "error" {
		t.Errorf("StateError = %q", StateError)
	}
}

// ── mapGitLabState ────────────────────────────────────────────────────────────

func TestMapGitLabState(t *testing.T) {
	cases := []struct {
		in   State
		want string
	}{
		{StateSuccess, "success"},
		{StateFailure, "failed"},
		{StatePending, "pending"},
		{StateError, "failed"},
	}
	for _, c := range cases {
		got := mapGitLabState(c.in)
		if got != c.want {
			t.Errorf("mapGitLabState(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

func stringReader(s string) *strings.Reader { return strings.NewReader(s) }

// redirectTransport rewrites all outgoing requests to point at base,
// preserving path/query. Lets tests intercept calls to real APIs.
type redirectTransport struct {
	base string
	real http.RoundTripper
}

func (r *redirectTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	clone := req.Clone(req.Context())
	clone.URL.Scheme = "http"
	clone.URL.Host = strings.TrimPrefix(r.base, "http://")
	return r.real.RoundTrip(clone)
}
