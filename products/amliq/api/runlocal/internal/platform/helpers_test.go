package platform

import "testing"

func TestStr(t *testing.T) {
	tests := []struct {
		name string
		in   interface{}
		want string
	}{
		{"string value", "hello", "hello"},
		{"nil value", nil, ""},
		{"int value", 42, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := str(tt.in); got != tt.want {
				t.Errorf("str(%v) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestIntVal(t *testing.T) {
	tests := []struct {
		name string
		in   interface{}
		want int
	}{
		{"float64", float64(42), 42},
		{"int", int(7), 7},
		{"nil", nil, 0},
		{"string", "bad", 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := intVal(tt.in); got != tt.want {
				t.Errorf("intVal(%v) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}

func TestNested(t *testing.T) {
	m := map[string]interface{}{
		"a": map[string]interface{}{
			"b": "deep",
		},
	}
	tests := []struct {
		name   string
		keys   []string
		wantOK bool
		want   string
	}{
		{"valid path", []string{"a", "b"}, true, "deep"},
		{"missing key", []string{"a", "z"}, false, ""},
		{"invalid intermediate", []string{"x", "y"}, false, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v, ok := nested(m, tt.keys...)
			if ok != tt.wantOK {
				t.Errorf("nested() ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && str(v) != tt.want {
				t.Errorf("nested() = %v, want %q", v, tt.want)
			}
		})
	}
}
