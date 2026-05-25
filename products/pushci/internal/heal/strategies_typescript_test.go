package heal

import "testing"

func TestTSMissingModule(t *testing.T) {
	tests := []struct {
		output  string
		want    bool
		pattern string
	}{
		{"Cannot find module 'express'", true, "ts-missing-module"},
		{"Cannot find module './utils/format'", true, "ts-missing-local-module"},
		{"Cannot find module '$stores/auth'", true, "ts-missing-local-module"},
		{"build succeeded", false, ""},
	}
	for _, tt := range tests {
		fix := tsMissingModule(tt.output)
		if (fix != nil) != tt.want {
			t.Errorf("tsMissingModule(%q) = %v, want %v", tt.output, fix != nil, tt.want)
		}
		if fix != nil && fix.Pattern != tt.pattern {
			t.Errorf("pattern = %q, want %q", fix.Pattern, tt.pattern)
		}
	}
}

func TestTSMissingType(t *testing.T) {
	tests := []struct {
		output  string
		want    bool
		pattern string
	}{
		{"Cannot find name 'JSX'", true, "ts-missing-type-package"},
		{"Cannot find name 'React'", true, "ts-missing-type-package"},
		{"Cannot find name 'MyCustomType'", true, "ts-missing-name"},
		{"compilation successful", false, ""},
	}
	for _, tt := range tests {
		fix := tsMissingType(tt.output)
		if (fix != nil) != tt.want {
			t.Errorf("tsMissingType(%q) = %v, want %v", tt.output, fix != nil, tt.want)
		}
		if fix != nil && fix.Pattern != tt.pattern {
			t.Errorf("pattern = %q, want %q", fix.Pattern, tt.pattern)
		}
	}
}

func TestTSPropertyNotExist(t *testing.T) {
	fix := tsPropertyNotExist("Property 'name' does not exist on type 'User'")
	if fix == nil {
		t.Fatal("expected fix")
	}
	if fix.Pattern != "ts-property-missing" {
		t.Errorf("pattern = %q", fix.Pattern)
	}

	if tsPropertyNotExist("all good") != nil {
		t.Error("expected nil for clean output")
	}
}

func TestTSTypeNotAssignable(t *testing.T) {
	fix := tsTypeNotAssignable("Type 'string' is not assignable to type 'number'")
	if fix == nil {
		t.Fatal("expected fix")
	}
	if fix.Pattern != "ts-type-mismatch" {
		t.Errorf("pattern = %q", fix.Pattern)
	}
}

func TestTSMissingExport(t *testing.T) {
	fix := tsMissingExport(`Module '"./types"' has no exported member 'User'`)
	if fix == nil {
		t.Fatal("expected fix")
	}
	if fix.Pattern != "ts-missing-export" {
		t.Errorf("pattern = %q", fix.Pattern)
	}
}

func TestExtractPackageName(t *testing.T) {
	tests := []struct {
		mod, want string
	}{
		{"express", "express"},
		{"@types/node", "@types/node"},
		{"@sveltejs/kit/vite", "@sveltejs/kit"},
		{"lodash/debounce", "lodash"},
	}
	for _, tt := range tests {
		if got := extractPackageName(tt.mod); got != tt.want {
			t.Errorf("extractPackageName(%q) = %q, want %q", tt.mod, got, tt.want)
		}
	}
}
