package github

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
)

func newTestConnector(oauth, base string) (*Connector, *connectors.MemoryStore) {
	store := connectors.NewMemoryStore()
	c := New(nil, store, Config{
		ClientID:     "cid",
		ClientSecret: "secret",
		RedirectURI:  "http://localhost/cb",
	})
	c.OAuthURL = oauth
	c.BaseURL = base
	return c, store
}

func TestAuthenticate_OAuthExchange(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/login/oauth/access_token" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if r.Header.Get("Accept") != "application/json" {
			t.Errorf("Accept = %s", r.Header.Get("Accept"))
		}
		body, _ := io.ReadAll(r.Body)
		v, _ := url.ParseQuery(string(body))
		if v.Get("code") != "abc" || v.Get("client_id") != "cid" {
			t.Errorf("form = %s", body)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": "ghs_xx", "token_type": "bearer", "scope": "repo",
		})
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL, srv.URL)
	if err := c.Authenticate(context.Background(), tenant, "abc"); err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	tok, err := store.Load(context.Background(), tenant, Name)
	if err != nil || tok.AccessToken != "ghs_xx" {
		t.Fatalf("token = %+v err=%v", tok, err)
	}
}

func TestAuthenticate_OAuthError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "bad_verification_code"})
	}))
	defer srv.Close()
	c, _ := newTestConnector(srv.URL, srv.URL)
	err := c.Authenticate(context.Background(), uuid.New(), "x")
	if err == nil || !strings.Contains(err.Error(), "bad_verification_code") {
		t.Fatalf("err = %v", err)
	}
}

func TestListResources_PaginatesViaLinkHeader(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok" {
			t.Errorf("auth = %q", r.Header.Get("Authorization"))
		}
		if r.Header.Get("X-GitHub-Api-Version") != "2022-11-28" {
			t.Errorf("version = %q", r.Header.Get("X-GitHub-Api-Version"))
		}
		page := r.URL.Query().Get("page")
		switch page {
		case "1":
			w.Header().Set("Link", `<https://x?page=2>; rel="next", <https://x?page=2>; rel="last"`)
			_ = json.NewEncoder(w).Encode(ghRepoListResp{Repositories: []ghRepo{{FullName: "o/r1", HTMLURL: "http://r1"}}})
		case "2":
			_ = json.NewEncoder(w).Encode(ghRepoListResp{Repositories: []ghRepo{{FullName: "o/r2", HTMLURL: "http://r2"}}})
		default:
			t.Errorf("page = %s", page)
		}
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL, srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	got, err := c.ListResources(context.Background(), tenant)
	if err != nil {
		t.Fatalf("ListResources: %v", err)
	}
	if len(got) != 2 || got[0].ID != "o/r1" || got[1].ID != "o/r2" {
		t.Errorf("got = %+v", got)
	}
}

func TestFetch_IssueRoundTrip(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		want := "/repos/octo/hello/issues/42"
		if r.URL.Path != want {
			t.Errorf("path = %s want %s", r.URL.Path, want)
		}
		_ = json.NewEncoder(w).Encode(ghIssue{
			Number: 42, Title: "bug", Body: "details",
			HTMLURL: "http://x", State: "open",
		})
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL, srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	doc, err := c.Fetch(context.Background(), tenant, "octo/hello#42")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if doc.Title != "bug" || string(doc.Body) != "details" {
		t.Errorf("doc = %+v", doc)
	}
}

func TestFetch_BadResourceID(t *testing.T) {
	c, store := newTestConnector("http://unused", "http://unused")
	_ = store.Save(context.Background(), uuid.Nil, Name, connectors.Token{AccessToken: "tok"})
	_, err := c.Fetch(context.Background(), uuid.Nil, "no-hash")
	if err == nil || !strings.Contains(err.Error(), "invalid resource id") {
		t.Fatalf("err = %v", err)
	}
}

func TestSearch_IssuesQuery(t *testing.T) {
	tenant := uuid.New()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/search/issues" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if r.URL.Query().Get("q") != "label:bug" {
			t.Errorf("q = %s", r.URL.Query().Get("q"))
		}
		_ = json.NewEncoder(w).Encode(ghSearchResp{Items: []ghIssue{{Number: 7, Title: "x", HTMLURL: "http://x"}}})
	}))
	defer srv.Close()
	c, store := newTestConnector(srv.URL, srv.URL)
	_ = store.Save(context.Background(), tenant, Name, connectors.Token{AccessToken: "tok"})
	got, err := c.Search(context.Background(), tenant, "label:bug")
	if err != nil || len(got) != 1 || got[0].Title != "x" {
		t.Fatalf("Search: got=%+v err=%v", got, err)
	}
}

func TestRegister_AddsMetadata(t *testing.T) {
	r := connectors.NewRegistry()
	if err := Register(r, nil, connectors.NewMemoryStore(), Config{}); err != nil {
		t.Fatalf("Register: %v", err)
	}
	if _, ok := r.Get(Name); !ok {
		t.Fatal("not registered")
	}
}
