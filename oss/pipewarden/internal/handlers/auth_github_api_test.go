package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// patchGitHubURLs swaps the OAuth and API base URLs to point at test servers.
// Restores both on cleanup.
func patchGitHubURLs(t *testing.T, oauth, api string) {
	t.Helper()
	origOAuth := githubOAuthBaseURL
	origAPI := githubAPIBaseURL
	githubOAuthBaseURL = oauth
	githubAPIBaseURL = api
	t.Cleanup(func() {
		githubOAuthBaseURL = origOAuth
		githubAPIBaseURL = origAPI
	})
}

func TestExchangeGitHubCodeHappy(t *testing.T) {
	oauth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/login/oauth/access_token") {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_ = r.ParseForm()
		if r.PostFormValue("code") != "abc" {
			t.Errorf("missing code in form: %v", r.PostForm)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"gho_test_token"}`))
	}))
	defer oauth.Close()
	patchGitHubURLs(t, oauth.URL, oauth.URL)

	h, _ := newTestHandlersDB(t)
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_ID", "id")
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_SECRET", "secret")

	token, err := h.exchangeGitHubCode(context.Background(), "abc", "http://localhost/cb")
	if err != nil {
		t.Fatalf("exchange: %v", err)
	}
	if token != "gho_test_token" {
		t.Fatalf("token=%q", token)
	}
}

func TestExchangeGitHubCodeNon200(t *testing.T) {
	oauth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte("bad creds"))
	}))
	defer oauth.Close()
	patchGitHubURLs(t, oauth.URL, oauth.URL)

	h, _ := newTestHandlersDB(t)
	if _, err := h.exchangeGitHubCode(context.Background(), "abc", "http://localhost/cb"); err == nil {
		t.Fatalf("expected error on 401")
	}
}

func TestExchangeGitHubCodeErrorBody(t *testing.T) {
	oauth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"error":"bad_verification_code","error_description":"expired"}`))
	}))
	defer oauth.Close()
	patchGitHubURLs(t, oauth.URL, oauth.URL)

	h, _ := newTestHandlersDB(t)
	_, err := h.exchangeGitHubCode(context.Background(), "abc", "http://localhost/cb")
	if err == nil || !strings.Contains(err.Error(), "bad_verification_code") {
		t.Fatalf("expected error body to surface: %v", err)
	}
}

func TestExchangeGitHubCodeEmptyToken(t *testing.T) {
	oauth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	defer oauth.Close()
	patchGitHubURLs(t, oauth.URL, oauth.URL)

	h, _ := newTestHandlersDB(t)
	if _, err := h.exchangeGitHubCode(context.Background(), "abc", "http://localhost/cb"); err == nil {
		t.Fatalf("expected error for empty token")
	}
}

func TestFetchGitHubUserHappy(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/user" {
			_, _ = w.Write([]byte(`{"id":42,"email":"u@example.com","name":"Userino","login":"ulogin"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer api.Close()
	patchGitHubURLs(t, api.URL, api.URL)

	h, _ := newTestHandlersDB(t)
	id, email, name, err := h.fetchGitHubUser(context.Background(), "tok")
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if id != 42 || email != "u@example.com" || name != "Userino" {
		t.Fatalf("got id=%d email=%s name=%s", id, email, name)
	}
}

func TestFetchGitHubUserFallsBackToLogin(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/user" {
			_, _ = w.Write([]byte(`{"id":7,"email":"","name":"","login":"loginonly"}`))
			return
		}
		if r.URL.Path == "/user/emails" {
			_, _ = w.Write([]byte(`[{"email":"primary@x.com","primary":true,"verified":true}]`))
			return
		}
	}))
	defer api.Close()
	patchGitHubURLs(t, api.URL, api.URL)

	h, _ := newTestHandlersDB(t)
	_, email, name, err := h.fetchGitHubUser(context.Background(), "tok")
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if email != "primary@x.com" {
		t.Fatalf("primary email fallback failed: %q", email)
	}
	if name != "loginonly" {
		t.Fatalf("login fallback failed: %q", name)
	}
}

func TestFetchGitHubUserNon200(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer api.Close()
	patchGitHubURLs(t, api.URL, api.URL)

	h, _ := newTestHandlersDB(t)
	if _, _, _, err := h.fetchGitHubUser(context.Background(), "tok"); err == nil {
		t.Fatalf("expected error on 403")
	}
}

func TestFetchGitHubPrimaryEmailNoVerified(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`[{"email":"unverified@x.com","primary":true,"verified":false}]`))
	}))
	defer api.Close()
	patchGitHubURLs(t, api.URL, api.URL)

	h, _ := newTestHandlersDB(t)
	if _, err := h.fetchGitHubPrimaryEmail(context.Background(), "tok"); err == nil {
		t.Fatalf("expected error when no verified primary")
	}
}

func TestFetchGitHubPrimaryEmailNon200(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer api.Close()
	patchGitHubURLs(t, api.URL, api.URL)

	h, _ := newTestHandlersDB(t)
	if _, err := h.fetchGitHubPrimaryEmail(context.Background(), "tok"); err == nil {
		t.Fatalf("expected error on 500")
	}
}

func TestPostGitHubCommentHappy(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/owner/repo/issues/42/comments" {
			t.Errorf("path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()
	patchGitHubURLs(t, srv.URL, srv.URL)
	// postGitHubComment builds the URL itself with hardcoded api.github.com;
	// re-route by calling postGitHubCommentToURL directly with srv URL.
	if err := postGitHubCommentToURL(srv.URL+"/repos/owner/repo/issues/42/comments", "tok", "hi"); err != nil {
		t.Fatalf("post: %v", err)
	}
}

func TestPostGitHubCommentNon2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()
	if err := postGitHubCommentToURL(srv.URL+"/repos/o/r/issues/1/comments", "tok", "hi"); err == nil {
		t.Fatalf("expected 403 error")
	}
}
