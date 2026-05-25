package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGitLabOAuthAuthorizeURL(t *testing.T) {
	g := &GitLabOAuth{
		ClientID:    "cid-123",
		RedirectURI: "https://app.example.com/callback",
		Scopes:      []string{"read_api", "read_repository"},
	}
	u := g.AuthorizeURL("state-abc")
	if !strings.Contains(u, "client_id=cid-123") {
		t.Errorf("missing client_id in url: %s", u)
	}
	if !strings.Contains(u, "state=state-abc") {
		t.Errorf("missing state in url: %s", u)
	}
	if !strings.Contains(u, "response_type=code") {
		t.Errorf("missing response_type in url: %s", u)
	}
	if !strings.HasPrefix(u, "https://gitlab.com/oauth/authorize") {
		t.Errorf("wrong base url: %s", u)
	}
}

func TestGitLabOAuthAuthorizeURLSelfHosted(t *testing.T) {
	g := &GitLabOAuth{
		ClientID:    "cid",
		RedirectURI: "https://app.example.com/cb",
		BaseURL:     "https://gitlab.internal.corp/",
	}
	u := g.AuthorizeURL("s")
	if !strings.HasPrefix(u, "https://gitlab.internal.corp/oauth/authorize") {
		t.Errorf("self-hosted base url not respected: %s", u)
	}
}

func TestGitLabOAuthExchangeCode(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/oauth/token" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("unexpected method: %s", r.Method)
		}
		_ = r.ParseForm()
		if r.FormValue("code") != "abc" {
			t.Errorf("expected code=abc, got %s", r.FormValue("code"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(GitLabToken{
			AccessToken:  "access-123",
			TokenType:    "Bearer",
			ExpiresIn:    7200,
			RefreshToken: "refresh-456",
		})
	}))
	defer srv.Close()

	g := &GitLabOAuth{ClientID: "c", ClientSecret: "s", RedirectURI: "r", BaseURL: srv.URL}
	tok, err := g.ExchangeCode(nil, "abc")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tok.AccessToken != "access-123" {
		t.Errorf("got access token %q", tok.AccessToken)
	}
	if tok.RefreshToken != "refresh-456" {
		t.Errorf("got refresh token %q", tok.RefreshToken)
	}
}

func TestGitLabOAuthExchangeCodeErrorStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
	}))
	defer srv.Close()

	g := &GitLabOAuth{ClientID: "c", ClientSecret: "s", RedirectURI: "r", BaseURL: srv.URL}
	if _, err := g.ExchangeCode(nil, "bad"); err == nil {
		t.Error("expected error on 400 status, got nil")
	}
}

func TestGitLabOAuthExchangeCodeEmptyToken(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":""}`))
	}))
	defer srv.Close()

	g := &GitLabOAuth{ClientID: "c", ClientSecret: "s", RedirectURI: "r", BaseURL: srv.URL}
	if _, err := g.ExchangeCode(nil, "x"); err == nil {
		t.Error("expected error when access_token empty, got nil")
	}
}

func TestGitLabOAuthRefreshToken(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		if r.FormValue("grant_type") != "refresh_token" {
			t.Errorf("expected grant_type=refresh_token, got %s", r.FormValue("grant_type"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"new","token_type":"Bearer","refresh_token":"rot"}`))
	}))
	defer srv.Close()

	g := &GitLabOAuth{ClientID: "c", ClientSecret: "s", RedirectURI: "r", BaseURL: srv.URL}
	tok, err := g.RefreshToken(nil, "old-refresh")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tok.AccessToken != "new" || tok.RefreshToken != "rot" {
		t.Errorf("unexpected tokens: %+v", tok)
	}
}
