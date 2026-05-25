package templates

import "testing"

func TestRegistryBuiltins(t *testing.T) {
	r := NewRegistry()
	tests := []struct {
		id    string
		stack string
	}{
		{"node-basic", "node"},
		{"go-basic", "go"},
		{"python-basic", "python"},
		{"docker-build", "docker"},
		{"security-scan", "any"},
		{"k8s-deploy", "k8s"},
	}
	for _, tt := range tests {
		t.Run(tt.id, func(t *testing.T) {
			tmpl, ok := r.Get(tt.id)
			if !ok {
				t.Fatalf("template %q not found", tt.id)
			}
			if tmpl.Stack != tt.stack {
				t.Errorf("stack = %q, want %q", tmpl.Stack, tt.stack)
			}
			if tmpl.YAML == "" {
				t.Error("expected non-empty YAML")
			}
		})
	}
}

func TestRegistrySearch(t *testing.T) {
	r := NewRegistry()
	results := r.Search("node")
	if len(results) == 0 {
		t.Error("expected results for 'node' search")
	}
}

func TestRegistryListByStack(t *testing.T) {
	r := NewRegistry()
	goTemplates := r.ListByStack("go")
	if len(goTemplates) == 0 {
		t.Error("expected Go templates")
	}
}

func TestRegistryPublish(t *testing.T) {
	r := NewRegistry()
	r.Publish(&Template{ID: "custom-1", Name: "Custom", Stack: "rust", Public: true})
	tmpl, ok := r.Get("custom-1")
	if !ok || tmpl.Name != "Custom" {
		t.Error("expected published template")
	}
}
