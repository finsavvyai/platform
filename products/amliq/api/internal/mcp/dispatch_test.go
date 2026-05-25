package mcp

import (
	"encoding/json"
	"testing"
)

func TestHandleToolCallUnknown(t *testing.T) {
	s := testServer()
	params, _ := json.Marshal(map[string]string{"name": "nonexistent"})
	req := JSONRPCRequest{
		JSONRPC: "2.0", ID: "1", Method: "tools/call",
		Params: params,
	}
	resp := s.handleToolCall(req)
	if resp.Error == nil {
		t.Fatal("expected error for unknown tool")
	}
	if resp.Error.Code != -32602 {
		t.Errorf("code = %d, want -32602", resp.Error.Code)
	}
}

func TestHandleListToolsReturnsAll(t *testing.T) {
	s := testServer()
	req := JSONRPCRequest{JSONRPC: "2.0", ID: "1", Method: "tools/list"}
	resp := s.handleListTools(req)
	if resp.Error != nil {
		t.Fatalf("unexpected error: %v", resp.Error)
	}
	var data map[string]interface{}
	json.Unmarshal(resp.Result, &data)
	tools := data["tools"].([]interface{})
	if len(tools) < 5 {
		t.Errorf("expected at least 5 tools, got %d", len(tools))
	}
}

func TestSuccessResp(t *testing.T) {
	resp := successResp("42", map[string]string{"ok": "true"})
	if resp.ID != "42" {
		t.Errorf("ID = %s, want 42", resp.ID)
	}
	if resp.Error != nil {
		t.Error("expected no error")
	}
}

func TestErrorResp(t *testing.T) {
	resp := errorResp("99", -32600, "bad request")
	if resp.Error == nil {
		t.Fatal("expected error")
	}
	if resp.Error.Code != -32600 {
		t.Errorf("code = %d, want -32600", resp.Error.Code)
	}
}

func TestMustJSON(t *testing.T) {
	result := mustJSON(map[string]int{"a": 1})
	if result == "" {
		t.Error("expected non-empty JSON string")
	}
}
