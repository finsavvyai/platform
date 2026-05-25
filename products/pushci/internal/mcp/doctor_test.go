package mcp

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestToolCallDoctor(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantText string
	}{
		{
			"doctor returns checks",
			`{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{` +
				`"name":"pushci_doctor","arguments":{"directory":"/tmp"}}}`,
			"checks",
		},
		{
			"doctor includes all_passed field",
			`{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{` +
				`"name":"pushci_doctor","arguments":{"directory":"/tmp"}}}`,
			"all_passed",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := roundTrip(t, tt.input)
			if resp.Error != nil {
				t.Fatalf("unexpected error: %s", resp.Error.Message)
			}
			data, _ := json.Marshal(resp.Result)
			if !strings.Contains(string(data), tt.wantText) {
				t.Errorf("result missing %q: %s", tt.wantText, data)
			}
		})
	}
}
