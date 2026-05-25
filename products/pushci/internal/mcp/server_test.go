package mcp

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestInitialize(t *testing.T) {
	tests := []struct {
		name    string
		wantVer string
	}{
		{"returns protocol version", "2024-11-05"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := roundTrip(t, `{"jsonrpc":"2.0","id":1,"method":"initialize"}`)
			if resp.Error != nil {
				t.Fatalf("unexpected error: %s", resp.Error.Message)
			}
			var result InitializeResult
			remarshal(resp.Result, &result)
			if result.ProtocolVersion != tt.wantVer {
				t.Errorf("got version %q, want %q", result.ProtocolVersion, tt.wantVer)
			}
			if result.ServerInfo.Name != "pushci" {
				t.Errorf("got name %q, want pushci", result.ServerInfo.Name)
			}
		})
	}
}

func TestToolsList(t *testing.T) {
	tests := []struct {
		name      string
		wantCount int
		wantNames []string
	}{
		{"returns all tools", 9, []string{
			"pushci_init", "pushci_run", "pushci_status",
			"pushci_doctor", "pushci_secret_set",
			"pushci_scan",
			"pushci_recommend", "pushci_heal", "pushci_promote",
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := roundTrip(t, `{"jsonrpc":"2.0","id":2,"method":"tools/list"}`)
			var result ToolsListResult
			remarshal(resp.Result, &result)
			if len(result.Tools) != tt.wantCount {
				t.Fatalf("got %d tools, want %d", len(result.Tools), tt.wantCount)
			}
			for i, name := range tt.wantNames {
				if result.Tools[i].Name != name {
					t.Errorf("tool[%d] = %q, want %q", i, result.Tools[i].Name, name)
				}
			}
		})
	}
}

func roundTrip(t *testing.T, req string) JsonRpcResponse {
	t.Helper()
	in := strings.NewReader(req + "\n")
	var out bytes.Buffer
	srv := NewServer(in, &out, "test")
	if err := srv.Run(); err != nil {
		t.Fatalf("server.Run: %v", err)
	}
	var resp JsonRpcResponse
	json.Unmarshal(out.Bytes(), &resp)
	return resp
}

func remarshal(src any, dst any) {
	data, _ := json.Marshal(src)
	json.Unmarshal(data, dst)
}
