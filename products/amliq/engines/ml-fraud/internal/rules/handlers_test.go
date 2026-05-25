package rules

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// setupRouter creates a test Gin router with the rules handler mounted
// and a middleware that sets user_id (tenant) from a header for testing.
func setupRouter() (*gin.Engine, *MemoryStore) {
	store := NewMemoryStore()
	engine := NewEngine(store)
	handler := NewHandler(store, engine)

	r := gin.New()

	// Simulate auth middleware: set user_id from X-Tenant-ID header
	r.Use(func(c *gin.Context) {
		if tid := c.GetHeader("X-Tenant-ID"); tid != "" {
			c.Set("user_id", tid)
		}
		c.Next()
	})

	group := r.Group("/api/v1/rules")
	group.POST("", handler.CreateRule)
	group.GET("", handler.ListRules)
	group.GET("/:id", handler.GetRule)
	group.PUT("/:id", handler.UpdateRule)
	group.DELETE("/:id", handler.DeleteRule)
	group.PATCH("/:id/toggle", handler.ToggleRule)
	group.POST("/test", handler.TestRule)

	return r, store
}

func jsonBody(v interface{}) *bytes.Buffer {
	b, _ := json.Marshal(v)
	return bytes.NewBuffer(b)
}

func validRuleJSON() map[string]interface{} {
	return map[string]interface{}{
		"name": "Test Rule",
		"conditions": []map[string]interface{}{
			{"field": "amount", "operator": "gt", "value": 1000},
		},
		"logic_operator": "AND",
		"actions": []map[string]interface{}{
			{"type": "block"},
		},
		"priority": 50,
		"enabled":  true,
	}
}

// --- Create ---

func TestHandler_CreateRule_Success(t *testing.T) {
	r, _ := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/rules", jsonBody(validRuleJSON()))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandler_CreateRule_MissingTenant(t *testing.T) {
	r, _ := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/rules", jsonBody(validRuleJSON()))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestHandler_CreateRule_InvalidJSON(t *testing.T) {
	r, _ := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/rules", bytes.NewBufferString("{bad"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_CreateRule_ValidationError(t *testing.T) {
	r, _ := setupRouter()
	w := httptest.NewRecorder()
	body := validRuleJSON()
	body["name"] = ""
	req, _ := http.NewRequest("POST", "/api/v1/rules", jsonBody(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// --- List ---

func TestHandler_ListRules(t *testing.T) {
	r, _ := setupRouter()

	// Create a rule first
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/rules", jsonBody(validRuleJSON()))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w, req)

	// List
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/api/v1/rules", nil)
	req2.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w2.Code)
	}
}

// --- Get ---

func TestHandler_GetRule(t *testing.T) {
	r, _ := setupRouter()

	// Create
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/rules", jsonBody(validRuleJSON()))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	ruleMap := resp["rule"].(map[string]interface{})
	id := ruleMap["id"].(string)

	// Get
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/api/v1/rules/"+id, nil)
	req2.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w2.Code)
	}
}

// --- Tenant isolation: cannot access another tenant's rules ---

func TestHandler_TenantIsolation(t *testing.T) {
	r, _ := setupRouter()

	// Create as tenant-A
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/rules", jsonBody(validRuleJSON()))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "tenant-A")
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	ruleMap := resp["rule"].(map[string]interface{})
	id := ruleMap["id"].(string)

	// Try to get as tenant-B
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/api/v1/rules/"+id, nil)
	req2.Header.Set("X-Tenant-ID", "tenant-B")
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusNotFound {
		t.Fatalf("tenant-B should not see tenant-A rule, got %d", w2.Code)
	}
}

// --- Delete ---

func TestHandler_DeleteRule(t *testing.T) {
	r, _ := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/rules", jsonBody(validRuleJSON()))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	ruleMap := resp["rule"].(map[string]interface{})
	id := ruleMap["id"].(string)

	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("DELETE", "/api/v1/rules/"+id, nil)
	req2.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w2.Code)
	}
}

// --- Toggle ---

func TestHandler_ToggleRule(t *testing.T) {
	r, _ := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/rules", jsonBody(validRuleJSON()))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w, req)

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	ruleMap := resp["rule"].(map[string]interface{})
	id := ruleMap["id"].(string)

	w2 := httptest.NewRecorder()
	body := map[string]bool{"enabled": false}
	req2, _ := http.NewRequest("PATCH", "/api/v1/rules/"+id+"/toggle", jsonBody(body))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w2.Code, w2.Body.String())
	}
}

// --- Test / Dry-run ---

func TestHandler_TestRuleDryRun(t *testing.T) {
	r, _ := setupRouter()

	body := map[string]interface{}{
		"rule": validRuleJSON(),
		"transaction": map[string]interface{}{
			"transaction_id": "txn-dry",
			"amount":         5000,
			"timestamp":      "2026-03-01T10:00:00Z",
			"merchant_id":    "MER-1",
			"user_id":        "u1",
			"payment_method": "credit_card",
		},
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/rules/test", jsonBody(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
