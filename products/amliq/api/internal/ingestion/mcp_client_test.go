package ingestion

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMCPClient_CallTool_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer tok-123" {
			t.Errorf("auth header = %q", got)
		}
		body, _ := io.ReadAll(r.Body)
		var req map[string]interface{}
		_ = json.Unmarshal(body, &req)
		params := req["params"].(map[string]interface{})
		if params["name"] != "screen" {
			t.Errorf("tool name = %v", params["name"])
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"jsonrpc": "2.0", "id": req["id"],
			"result": map[string]interface{}{
				"content": []interface{}{
					map[string]interface{}{"type": "text", "text": `{"hits":1}`},
				},
			},
		})
	}))
	defer srv.Close()

	c := NewMCPClient(srv.URL, "tok-123", nil)
	res, err := c.CallTool(context.Background(), "screen", map[string]string{"name": "Acme"})
	if err != nil {
		t.Fatal(err)
	}
	if got := ToolText(res); got != `{"hits":1}` {
		t.Errorf("ToolText = %q", got)
	}
}

func TestMCPClient_CallTool_Non200(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusBadGateway)
	}))
	defer srv.Close()

	_, err := NewMCPClient(srv.URL, "", nil).
		CallTool(context.Background(), "any", nil)
	if err == nil || !strings.Contains(err.Error(), "status 502") {
		t.Errorf("expected 502 error, got %v", err)
	}
}

func TestMCPClient_CallTool_RPCError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"jsonrpc": "2.0", "id": 1,
			"error": map[string]interface{}{"code": -32601, "message": "no such tool"},
		})
	}))
	defer srv.Close()

	_, err := NewMCPClient(srv.URL, "", nil).
		CallTool(context.Background(), "missing", nil)
	if err == nil || !strings.Contains(err.Error(), "no such tool") {
		t.Errorf("expected RPC error propagated, got %v", err)
	}
}

func TestMCPClient_WithHeader(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("X-API-Key"); got != "k-9" {
			t.Errorf("X-API-Key = %q", got)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"jsonrpc": "2.0", "id": 1,
			"result": map[string]interface{}{"content": []interface{}{}},
		})
	}))
	defer srv.Close()

	_, err := NewMCPClient(srv.URL, "", nil).
		WithHeader("X-API-Key", "k-9").
		CallTool(context.Background(), "any", nil)
	if err != nil {
		t.Fatal(err)
	}
}

func TestToolText_Empty(t *testing.T) {
	if got := ToolText(map[string]interface{}{}); got != "" {
		t.Errorf("empty content should return empty string, got %q", got)
	}
}
