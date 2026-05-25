package entitlement

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCheckAllowed(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/ai_edit") {
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer tok" {
			t.Fatalf("missing bearer header, got %q", r.Header.Get("Authorization"))
		}
		_ = json.NewEncoder(w).Encode(Result{Plan: "pro", Feature: "ai_edit", Allowed: true})
	}))
	defer srv.Close()
	t.Setenv("PUSHCI_API_URL", srv.URL)

	r, err := Check(context.Background(), "tok", FeatureAIEdit)
	if err != nil {
		t.Fatal(err)
	}
	if !r.Allowed {
		t.Fatalf("expected Allowed=true, got %+v", r)
	}
	if err := RequireErr(r); err != nil {
		t.Fatalf("RequireErr should pass when allowed, got %v", err)
	}
}

func TestCheckDenied(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(Result{
			Plan: "free", Feature: "ai_edit", Allowed: false,
			UpgradeTo: "pro", UpgradeURL: "https://app.pushci.dev/billing",
		})
	}))
	defer srv.Close()
	t.Setenv("PUSHCI_API_URL", srv.URL)

	r, err := Check(context.Background(), "tok", FeatureAIEdit)
	if err != nil {
		t.Fatal(err)
	}
	if r.Allowed {
		t.Fatalf("expected Allowed=false")
	}
	msg := RequireErr(r).Error()
	if !strings.Contains(msg, "pro") || !strings.Contains(msg, "billing") {
		t.Fatalf("error should mention upgrade: %q", msg)
	}
}

func TestCheckUnauthorized(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()
	t.Setenv("PUSHCI_API_URL", srv.URL)

	r, err := Check(context.Background(), "", FeatureAIEdit)
	if err != nil {
		t.Fatal(err)
	}
	if r.Allowed {
		t.Fatalf("unauth should deny access")
	}
	if r.Plan != "free" {
		t.Fatalf("unauth should default to free plan, got %q", r.Plan)
	}
}
