package mcp

import (
	"encoding/json"
	"testing"

	"github.com/aegis-aml/aegis/internal/screening"
)

func testServer() *Server {
	idx := screening.NewSearchIndex()
	scorer := screening.NewWeightedScorer(nil)
	engine := screening.NewEngine(scorer, screening.WithSearchIndex(idx))
	return NewServer(engine, idx)
}

func TestServerInitialize(t *testing.T) {
	s := testServer()
	req := JSONRPCRequest{JSONRPC: "2.0", ID: "1", Method: "initialize"}
	resp := s.Handle(req)
	if resp.Error != nil {
		t.Fatalf("unexpected error: %s", resp.Error.Message)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if result["protocolVersion"] != "2024-11-05" {
		t.Errorf("protocol=%v, want 2024-11-05", result["protocolVersion"])
	}
	info := result["serverInfo"].(map[string]interface{})
	if info["name"] != "amliq-screening" {
		t.Errorf("name=%v, want amliq-screening", info["name"])
	}
}

func TestServerListTools(t *testing.T) {
	s := testServer()
	req := JSONRPCRequest{JSONRPC: "2.0", ID: "2", Method: "tools/list"}
	resp := s.Handle(req)
	if resp.Error != nil {
		t.Fatalf("unexpected error: %s", resp.Error.Message)
	}
	var result map[string]interface{}
	_ = json.Unmarshal(resp.Result, &result)
	tools, ok := result["tools"].([]interface{})
	if !ok || len(tools) < 5 {
		t.Errorf("expected at least 5 tools, got %d", len(tools))
	}
}

func TestServerUnknownMethod(t *testing.T) {
	s := testServer()
	req := JSONRPCRequest{JSONRPC: "2.0", ID: "3", Method: "unknown"}
	resp := s.Handle(req)
	if resp.Error == nil || resp.Error.Code != -32601 {
		t.Error("expected method not found error")
	}
}

func TestServerScreenEntity(t *testing.T) {
	s := testServer()
	params, _ := json.Marshal(map[string]interface{}{
		"name":      "screen_entity",
		"arguments": json.RawMessage(`{"name":"Test Person"}`),
	})
	req := JSONRPCRequest{
		JSONRPC: "2.0", ID: "4", Method: "tools/call",
		Params: params,
	}
	resp := s.Handle(req)
	if resp.Error != nil {
		t.Fatalf("unexpected error: %s", resp.Error.Message)
	}
}

func TestServerCountryRisk(t *testing.T) {
	s := testServer()
	params, _ := json.Marshal(map[string]interface{}{
		"name":      "check_country_risk",
		"arguments": json.RawMessage(`{"country_code":"IR"}`),
	})
	req := JSONRPCRequest{
		JSONRPC: "2.0", ID: "5", Method: "tools/call",
		Params: params,
	}
	resp := s.Handle(req)
	if resp.Error != nil {
		t.Fatalf("unexpected error: %s", resp.Error.Message)
	}
}
