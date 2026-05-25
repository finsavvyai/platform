package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func newTestHandlersForSemgrep(t *testing.T) (*Handlers, *storage.DB) {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("failed to create db: %v", err)
	}
	logger, err := logging.New(&logging.Config{Level: "error"})
	if err != nil {
		t.Fatalf("failed to create logger: %v", err)
	}
	h := New(db, integrations.NewManager(logger), nil, nil, logger, nil)
	return h, db
}

func TestCreateSemgrepRule(t *testing.T) {
	h, db := newTestHandlersForSemgrep(t)
	defer func() { _ = db.Close() }()

	rule := map[string]interface{}{
		"id":       "no-privileged",
		"name":     "No Privileged Container",
		"pattern":  `privileged.*true`,
		"message":  "Do not run privileged containers",
		"severity": "ERROR",
		"language": "yaml",
	}
	body, _ := json.Marshal(rule)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateSemgrepRule(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp storage.SemgrepRuleRow
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.ID != "no-privileged" {
		t.Errorf("expected id no-privileged, got %s", resp.ID)
	}
}

func TestDeleteSemgrepRule(t *testing.T) {
	h, db := newTestHandlersForSemgrep(t)
	defer func() { _ = db.Close() }()

	// Create a rule first
	err := db.CreateSemgrepRule(storage.SemgrepRuleRow{
		ID:       "to-delete",
		Name:     "Delete Me",
		Pattern:  `pattern`,
		Message:  "test message",
		Severity: "WARNING",
		Language: "yaml",
		Enabled:  true,
	})
	if err != nil {
		t.Fatalf("failed to create rule: %v", err)
	}

	// Delete it
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/semgrep/rules/to-delete", nil)
	w := httptest.NewRecorder()
	h.DeleteSemgrepRule(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", w.Code, w.Body.String())
	}

	// Verify it's gone
	_, err = db.GetSemgrepRule("to-delete")
	if err == nil {
		t.Fatal("expected rule to be deleted, but it still exists")
	}
}

func TestSemgrepRuleTest(t *testing.T) {
	h, db := newTestHandlersForSemgrep(t)
	defer func() { _ = db.Close() }()

	// Create rule with pattern
	err := db.CreateSemgrepRule(storage.SemgrepRuleRow{
		ID:       "priv-check",
		Name:     "Privileged check",
		Pattern:  `privileged.*true`,
		Message:  "Privileged container detected",
		Severity: "ERROR",
		Language: "yaml",
		Enabled:  true,
	})
	if err != nil {
		t.Fatalf("failed to create rule: %v", err)
	}

	// Test against matching YAML
	body, _ := json.Marshal(map[string]string{
		"content": "securityContext:\n  privileged: true\n",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules/priv-check/test", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.TestSemgrepRule(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	matched, ok := resp["matched"].(bool)
	if !ok || !matched {
		t.Errorf("expected matched=true, got %v", resp["matched"])
	}
}

func TestListSemgrepRules(t *testing.T) {
	h, db := newTestHandlersForSemgrep(t)
	defer func() { _ = db.Close() }()

	// Create 2 rules
	for _, r := range []storage.SemgrepRuleRow{
		{ID: "rule-one", Name: "Rule One", Pattern: `foo`, Message: "msg1", Severity: "WARNING", Language: "yaml", Enabled: true},
		{ID: "rule-two", Name: "Rule Two", Pattern: `bar`, Message: "msg2", Severity: "INFO", Language: "yaml", Enabled: true},
	} {
		if err := db.CreateSemgrepRule(r); err != nil {
			t.Fatalf("failed to create rule %s: %v", r.ID, err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/semgrep/rules", nil)
	w := httptest.NewRecorder()
	h.ListSemgrepRules(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var rules []storage.SemgrepRuleRow
	if err := json.NewDecoder(w.Body).Decode(&rules); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(rules) < 2 {
		t.Errorf("expected at least 2 rules, got %d", len(rules))
	}
}
