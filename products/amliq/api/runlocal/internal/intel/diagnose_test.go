package intel

import (
	"strings"
	"testing"
)

func TestDiagnoseError(t *testing.T) {
	tests := []struct {
		name       string
		output     string
		wantNil    bool
		wantPat    string
		wantSugSub string
	}{
		{
			"go module not found",
			"go: example.com/foo module example.com/foo not found",
			false, "module not found", "go mod tidy",
		},
		{
			"npm module missing",
			"Cannot find module 'express'",
			false, "Cannot find module", "npm install",
		},
		{
			"go test fail",
			"--- FAIL: TestFoo (0.00s)",
			false, "FAIL test", "failing test",
		},
		{
			"permission denied",
			"open /etc/secret: permission denied",
			false, "permission denied", "permissions",
		},
		{
			"port in use",
			"listen tcp :8080: address already in use",
			false, "port in use", "port",
		},
		{
			"out of memory",
			"fatal error: out of memory",
			false, "out of memory", "memory",
		},
		{
			"compile error",
			"main.go:42:10: undefined: Foo",
			false, "compilation error", "main.go",
		},
		{
			"node import error",
			"Module not found: Error: Can't resolve 'lodash'",
			false, "import error", "npm install lodash",
		},
		{
			"local import error",
			"Module not found: Error: Can't resolve './missing'",
			false, "import error", "import path",
		},
		{
			"unknown error",
			"everything is fine",
			true, "", "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := DiagnoseError(tt.output)
			if tt.wantNil {
				if d != nil {
					t.Errorf("expected nil, got %+v", d)
				}
				return
			}
			if d == nil {
				t.Fatal("expected diagnosis, got nil")
			}
			if d.Pattern != tt.wantPat {
				t.Errorf("pattern = %q, want %q", d.Pattern, tt.wantPat)
			}
			if !strings.Contains(d.Suggestion, tt.wantSugSub) {
				t.Errorf("suggestion %q should contain %q",
					d.Suggestion, tt.wantSugSub)
			}
			if d.Confidence <= 0 || d.Confidence > 1 {
				t.Errorf("confidence = %f, want (0,1]", d.Confidence)
			}
		})
	}
}

