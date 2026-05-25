package search

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNewDisabledByDefault(t *testing.T) {
	t.Setenv(envURL, "")
	c := New()
	if c.Enabled() {
		t.Error("expected disabled when URL unset")
	}
}

func TestDisabledIndexNoop(t *testing.T) {
	t.Setenv(envURL, "")
	c := New()
	if err := c.Index(context.Background(), FindingDoc{ID: 1}); err != nil {
		t.Errorf("disabled Index must be noop, got %v", err)
	}
}

func TestDisabledSimilarReturnsEmpty(t *testing.T) {
	t.Setenv(envURL, "")
	c := New()
	hits, err := c.Similar(context.Background(), 1, 5)
	if err != nil {
		t.Fatalf("disabled Similar must be noop, got %v", err)
	}
	if len(hits) != 0 {
		t.Errorf("disabled Similar must return empty, got %d", len(hits))
	}
}

func TestIndexPostsToEndpoint(t *testing.T) {
	got := make(chan string, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got <- r.URL.Path + "|" + r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	t.Setenv(envURL, srv.URL)
	t.Setenv(envAPIKey, "test-key")
	t.Setenv(envCollection, "things")
	c := New()
	if !c.Enabled() {
		t.Fatal("expected enabled")
	}
	err := c.Index(context.Background(), FindingDoc{ID: 42, Title: "x", CreatedAt: time.Now()})
	if err != nil {
		t.Fatalf("Index: %v", err)
	}
	select {
	case s := <-got:
		if !strings.Contains(s, "/collections/things/docs") {
			t.Errorf("wrong path: %s", s)
		}
		if !strings.Contains(s, "Bearer test-key") {
			t.Errorf("missing auth header: %s", s)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("no request received")
	}
}

func TestSimilarParsesHits(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"hits": []Hit{{ID: 2, Score: 0.88, Title: "similar-thing"}, {ID: 3, Score: 0.71, Title: "another"}},
		})
	}))
	defer srv.Close()

	t.Setenv(envURL, srv.URL)
	t.Setenv(envAPIKey, "")
	c := New()

	hits, err := c.Similar(context.Background(), 1, 5)
	if err != nil {
		t.Fatalf("Similar: %v", err)
	}
	if len(hits) != 2 {
		t.Fatalf("expected 2 hits, got %d", len(hits))
	}
	if hits[0].ID != 2 || hits[0].Score <= 0.87 {
		t.Errorf("first hit wrong: %+v", hits[0])
	}
}

func TestSimilarRejectsBadK(t *testing.T) {
	t.Setenv(envURL, "http://example.com")
	c := New()
	if _, err := c.Similar(context.Background(), 1, 0); err == nil {
		t.Error("expected error for k=0")
	}
	if _, err := c.Similar(context.Background(), 1, 9999); err == nil {
		t.Error("expected error for k too large")
	}
}

func TestIndexErrorsOnHTTP500(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"boom"}`))
	}))
	defer srv.Close()

	t.Setenv(envURL, srv.URL)
	c := New()
	if err := c.Index(context.Background(), FindingDoc{ID: 1}); err == nil {
		t.Error("expected error on 500")
	}
}
