package heal

import "testing"

func TestFlakyTest(t *testing.T) {
	tests := []struct {
		name    string
		output  string
		hasFix  bool
		pattern string
	}{
		{"go flaky test", "--- FAIL: TestFoo (timeout)\ndeadline exceeded", true, "flaky-test"},
		{"jest flaky test", "FAIL  src/utils.test.ts\nECONNRESET", true, "flaky-test"},
		{"python flaky test", "FAILED tests/test_api.py::test_health\ntimed out", true, "flaky-test"},
		{"not flaky - regular fail", "--- FAIL: TestFoo\nassert equal", false, ""},
		{"no test failure", "all good", false, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fix := flakyTest(tt.output)
			if tt.hasFix && fix == nil {
				t.Error("expected fix")
			}
			if !tt.hasFix && fix != nil {
				t.Errorf("unexpected fix: %+v", fix)
			}
			if fix != nil && fix.Pattern != tt.pattern {
				t.Errorf("pattern = %q, want %q", fix.Pattern, tt.pattern)
			}
		})
	}
}

func TestExtractFailingTest(t *testing.T) {
	tests := []struct {
		name   string
		output string
		want   string
	}{
		{"go test", "--- FAIL: TestFoo (0.01s)", "TestFoo"},
		{"jest", "FAIL src/utils.test.ts", "src/utils.test.ts"},
		{"pytest", "FAILED tests/test_api.py::test_health", "tests/test_api.py::test_health"},
		{"none", "all passed", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractFailingTest(tt.output)
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}
