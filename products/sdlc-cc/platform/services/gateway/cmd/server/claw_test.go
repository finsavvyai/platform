package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestHandleClawCapabilities(t *testing.T) {
	app := &Application{
		Claw: NewClawService(newMemoryClawStore(), nil, nil, nil, nil, "test-version"),
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/claw/capabilities", nil)
	rr := httptest.NewRecorder()

	app.handleClawCapabilities(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", rr.Code)
	}

	var response ClawCapabilitiesResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if response.Version != "test-version" {
		t.Fatalf("expected version test-version got %q", response.Version)
	}
	if len(response.Tools) == 0 {
		t.Fatalf("expected tool definitions in capabilities response")
	}
}

func TestClawMemoryLifecycle(t *testing.T) {
	app := &Application{
		Claw: NewClawService(newMemoryClawStore(), nil, nil, nil, nil, "test"),
	}

	writeBody := ClawMemoryWriteRequest{
		TenantID:   "tenant-1",
		UserID:     "user-1",
		SessionID:  "session-1",
		Type:       "fact",
		Content:    "customer prefers weekly security reports",
		Importance: 9,
		Tags:       []string{"preference", "reporting"},
	}

	memoryID := ""
	{
		payload, _ := json.Marshal(writeBody)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/claw/memory/write", bytes.NewReader(payload))
		rr := httptest.NewRecorder()
		app.handleClawMemoryWrite(rr, req)

		if rr.Code != http.StatusCreated {
			t.Fatalf("expected 201 got %d body=%s", rr.Code, rr.Body.String())
		}

		var memory ClawMemoryRecord
		if err := json.Unmarshal(rr.Body.Bytes(), &memory); err != nil {
			t.Fatalf("unmarshal write response: %v", err)
		}
		if memory.Content != writeBody.Content {
			t.Fatalf("expected memory content to round-trip")
		}
		memoryID = memory.ID
	}

	{
		searchBody := ClawMemorySearchRequest{
			TenantID: "tenant-1",
			UserID:   "user-1",
			Query:    "weekly security",
			Limit:    10,
		}
		payload, _ := json.Marshal(searchBody)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/claw/memory/search", bytes.NewReader(payload))
		rr := httptest.NewRecorder()
		app.handleClawMemorySearch(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 got %d body=%s", rr.Code, rr.Body.String())
		}

		var response struct {
			Count    int                `json:"count"`
			Memories []ClawMemoryRecord `json:"memories"`
		}
		if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
			t.Fatalf("unmarshal search response: %v", err)
		}
		if response.Count != 1 || len(response.Memories) != 1 {
			t.Fatalf("expected one memory result got %#v", response)
		}
	}

	{
		req := httptest.NewRequest(http.MethodGet, "/api/v1/claw/memory/"+memoryID+"?tenant_id=tenant-1&user_id=user-1", nil)
		rr := httptest.NewRecorder()
		req = withChiParam(req, "id", memoryID)
		app.handleClawMemoryGet(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 got %d body=%s", rr.Code, rr.Body.String())
		}
	}

	{
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/claw/memory/"+memoryID+"?tenant_id=tenant-1&user_id=user-1", nil)
		rr := httptest.NewRecorder()
		req = withChiParam(req, "id", memoryID)
		app.handleClawMemoryDelete(rr, req)

		if rr.Code != http.StatusNoContent {
			t.Fatalf("expected 204 got %d body=%s", rr.Code, rr.Body.String())
		}
	}
}

func TestClawToolListAndProviderHealth(t *testing.T) {
	app := &Application{
		Claw: NewClawService(newMemoryClawStore(), nil, nil, nil, nil, "test"),
	}

	{
		req := httptest.NewRequest(http.MethodPost, "/api/v1/claw/tools/list", nil)
		rr := httptest.NewRecorder()
		app.handleClawToolsList(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 got %d", rr.Code)
		}
	}

	{
		body := ClawToolCallRequest{
			Tool:      "provider_health",
			Arguments: map[string]any{},
		}
		payload, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/claw/tools/call", bytes.NewReader(payload))
		rr := httptest.NewRecorder()
		app.handleClawToolCall(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 got %d body=%s", rr.Code, rr.Body.String())
		}

		var response ClawToolCallResponse
		if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
			t.Fatalf("unmarshal tool response: %v", err)
		}
		if !response.Success {
			t.Fatalf("expected provider_health success response")
		}
	}
}

func withChiParam(req *http.Request, key, value string) *http.Request {
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add(key, value)
	return req.WithContext(contextWithRouteContext(req, routeContext))
}

func contextWithRouteContext(req *http.Request, routeContext *chi.Context) context.Context {
	return context.WithValue(req.Context(), chi.RouteCtxKey, routeContext)
}
