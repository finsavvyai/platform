package cli

import (
	"io"
	"os"
	"strings"
	"testing"
)

func captureStdout(fn func()) string {
	old := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w
	fn()
	w.Close()
	os.Stdout = old
	out, _ := io.ReadAll(r)
	return string(out)
}

func TestHeader(t *testing.T) {
	out := captureStdout(func() { Header("Test") })
	if !strings.Contains(out, "Test") {
		t.Error("Header should contain text")
	}
}

func TestStep(t *testing.T) {
	out := captureStdout(func() { Step(1, 5, "Building") })
	if !strings.Contains(out, "1/5") {
		t.Error("Step should contain step number")
	}
}

func TestSuccessErrorWarnInfo(t *testing.T) {
	tests := []struct {
		name string
		fn   func(string)
	}{
		{"Success", Success},
		{"Error", Error},
		{"Warn", Warn},
		{"Info", Info},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			out := captureStdout(func() { tt.fn("msg") })
			if !strings.Contains(out, "msg") {
				t.Errorf("%s should contain message", tt.name)
			}
		})
	}
}

func TestTable(t *testing.T) {
	out := captureStdout(func() {
		Table([]string{"Name", "Status"}, [][]string{
			{"test", "pass"},
			{"lint", "fail"},
		})
	})
	if !strings.Contains(out, "Name") || !strings.Contains(out, "test") {
		t.Error("Table should contain headers and data")
	}
}
