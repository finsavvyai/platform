package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

func TestListCustomPolicies_FiltersBuiltins(t *testing.T) {
	h := newTestHandlers(t)

	if err := h.db.CreatePolicy(storage.PolicyRow{
		ID: "user-1", Name: "user one", Pattern: "x", Message: "x", Severity: "high", IsBuiltin: false,
	}); err != nil {
		t.Fatalf("create user policy: %v", err)
	}
	if err := h.db.CreatePolicy(storage.PolicyRow{
		ID: "builtin-1", Name: "built one", Pattern: "y", Message: "y", Severity: "high", IsBuiltin: true,
	}); err != nil {
		t.Fatalf("create builtin policy: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/policies/custom", nil)
	rec := httptest.NewRecorder()
	h.ListCustomPolicies(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	var resp struct {
		Count    int                 `json:"count"`
		Policies []storage.PolicyRow `json:"policies"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Count != 1 {
		t.Errorf("count: got %d want 1", resp.Count)
	}
	if len(resp.Policies) != 1 || resp.Policies[0].ID != "user-1" {
		t.Errorf("expected only user-1; got %+v", resp.Policies)
	}
}

func TestListCustomPolicies_EmptyReturnsEmptyArray(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/policies/custom", nil)
	rec := httptest.NewRecorder()
	h.ListCustomPolicies(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"policies":[]`) {
		t.Errorf("body should contain empty array; got %s", rec.Body.String())
	}
}

func TestPolicyIDFromPath_HandlesCustomPrefix(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"/api/v1/policies/abc", "abc"},
		{"/api/v1/policies/abc/test", "abc"},
		{"/api/v1/policies/custom/abc", "abc"},
		{"/api/v1/policies/custom/abc/test", "abc"},
	}
	for _, c := range cases {
		if got := policyIDFromPath(c.in); got != c.want {
			t.Errorf("policyIDFromPath(%q) = %q; want %q", c.in, got, c.want)
		}
	}
}
