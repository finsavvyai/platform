package actions

import (
	"os"
	"path/filepath"
	"testing"
)

// withReadOnlyTempDir routes os.TempDir to a directory with no write
// permission so writeSecretsFile / writeEnvFile hit their os.CreateTemp
// failure branch. We restore TMPDIR via t.Setenv.
func withReadOnlyTempDir(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "ro")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(dir, 0o500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0o700) })
	t.Setenv("TMPDIR", dir)
	return dir
}

func TestWriteSecretsFile_CreateTempFailure(t *testing.T) {
	if os.Getuid() == 0 {
		t.Skip("root bypasses 0500 permission")
	}
	withReadOnlyTempDir(t)
	_, err := writeSecretsFile(map[string]string{"K": "v"})
	if err == nil {
		t.Fatal("expected error when temp dir is read-only")
	}
}

func TestWriteEnvFile_CreateTempFailure(t *testing.T) {
	if os.Getuid() == 0 {
		t.Skip("root bypasses 0500 permission")
	}
	withReadOnlyTempDir(t)
	_, err := writeEnvFile(map[string]string{"K": "v"})
	if err == nil {
		t.Fatal("expected error when temp dir is read-only")
	}
}
