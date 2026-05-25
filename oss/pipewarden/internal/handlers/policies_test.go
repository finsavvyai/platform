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

func newPolicyTestHandlers(t *testing.T) (*Handlers, func()) {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("failed to create in-memory db: %v", err)
	}
	logger, err := logging.New(&logging.Config{Level: "error"})
	if err != nil {
		t.Fatalf("failed to create logger: %v", err)
	}
	h := New(db, integrations.NewManager(logger), nil, nil, logger, nil)
	return h, func() { _ = db.Close() }
}

func TestCreatePolicy(t *testing.T) {
	h, cleanup := newPolicyTestHandlers(t)
	defer cleanup()

	body, _ := json.Marshal(map[string]interface{}{
		"id":       "require-pinned-actions",
		"name":     "Require Pinned Actions",
		"pattern":  `uses:\s+\w+/\w+@`,
		"message":  "Actions should be pinned to a full-length commit SHA",
		"severity": "high",
		"enabled":  true,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePolicy(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp storage.PolicyRow
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.ID != "require-pinned-actions" {
		t.Errorf("expected id=require-pinned-actions, got %q", resp.ID)
	}
}

func TestCreatePolicyInvalidRegex(t *testing.T) {
	h, cleanup := newPolicyTestHandlers(t)
	defer cleanup()

	body, _ := json.Marshal(map[string]interface{}{
		"id":      "bad-policy",
		"name":    "Bad Policy",
		"pattern": "[invalid(regex",
		"message": "should fail",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePolicy(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdatePolicy(t *testing.T) {
	h, cleanup := newPolicyTestHandlers(t)
	defer cleanup()

	// Create
	body, _ := json.Marshal(map[string]interface{}{
		"id":       "update-test",
		"name":     "Original Name",
		"pattern":  `curl`,
		"message":  "original message",
		"severity": "low",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePolicy(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create failed: %d %s", w.Code, w.Body.String())
	}

	// Update
	update, _ := json.Marshal(map[string]interface{}{
		"id":       "update-test",
		"name":     "Updated Name",
		"pattern":  `curl`,
		"message":  "updated message",
		"severity": "medium",
		"enabled":  true,
	})
	req2 := httptest.NewRequest(http.MethodPut, "/api/v1/policies/update-test", bytes.NewReader(update))
	w2 := httptest.NewRecorder()
	h.UpdatePolicy(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w2.Code, w2.Body.String())
	}

	var resp storage.PolicyRow
	if err := json.NewDecoder(w2.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Name != "Updated Name" {
		t.Errorf("expected name=Updated Name, got %q", resp.Name)
	}
}

func TestDeleteCustomPolicy(t *testing.T) {
	h, cleanup := newPolicyTestHandlers(t)
	defer cleanup()

	// Create
	body, _ := json.Marshal(map[string]interface{}{
		"id":       "delete-me",
		"name":     "Delete Me",
		"pattern":  `wget`,
		"message":  "wget detected",
		"severity": "medium",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePolicy(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create failed: %d %s", w.Code, w.Body.String())
	}

	// Delete
	req2 := httptest.NewRequest(http.MethodDelete, "/api/v1/policies/delete-me", nil)
	w2 := httptest.NewRecorder()
	h.DeletePolicy(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w2.Code, w2.Body.String())
	}

	// Verify gone
	req3 := httptest.NewRequest(http.MethodGet, "/api/v1/policies", nil)
	w3 := httptest.NewRecorder()
	h.ListPolicies(w3, req3)

	var listResp map[string]interface{}
	_ = json.NewDecoder(w3.Body).Decode(&listResp)
	rawPolicies, _ := listResp["policies"].([]interface{})
	for _, p := range rawPolicies {
		pm := p.(map[string]interface{})
		if pm["id"] == "delete-me" {
			t.Error("policy should have been deleted")
		}
	}
}

func TestPolicyTest(t *testing.T) {
	h, cleanup := newPolicyTestHandlers(t)
	defer cleanup()

	// Create policy
	body, _ := json.Marshal(map[string]interface{}{
		"id":       "no-curl-bash",
		"name":     "No curl|bash pipe",
		"pattern":  `curl.*bash`,
		"message":  "curl piped to bash is dangerous",
		"severity": "critical",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePolicy(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create failed: %d %s", w.Code, w.Body.String())
	}

	// Test matching YAML
	testBody, _ := json.Marshal(map[string]string{
		"yaml_content": "run: curl https://example.com/install.sh | bash",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/policies/no-curl-bash/test", bytes.NewReader(testBody))
	w2 := httptest.NewRecorder()
	h.TestPolicy(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w2.Code, w2.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w2.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if matched, ok := resp["matched"].(bool); !ok || !matched {
		t.Errorf("expected matched=true, got %v", resp["matched"])
	}
}
