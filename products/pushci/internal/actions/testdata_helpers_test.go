package actions

import (
	"os"
	"path/filepath"
	"testing"
)

// mustReadFixture returns the bytes of a workflow fixture as a string,
// failing the test if the file is missing. Shared by the reusable and
// integration tests (reusable_integration_test.go, build tag: integration).
//
//nolint:unused
func mustReadFixture(t *testing.T, name string) string {
	t.Helper()
	body, err := os.ReadFile(filepath.Join("testdata", "workflows", name))
	if err != nil {
		t.Fatalf("read fixture %s: %v", name, err)
	}
	return string(body)
}
