package actions

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestVersion_MissingBinary(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	_, _, _, err := Version(context.Background())
	if err == nil {
		t.Fatal("expected error when act is missing")
	}
}

func TestVersion_ParsesFakeBinaryOutput(t *testing.T) {
	dir := t.TempDir()
	body := `#!/bin/sh
echo "act version 1.2.3"
`
	bin := filepath.Join(dir, "act")
	if err := os.WriteFile(bin, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))

	ma, mi, pa, err := Version(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if ma != 1 || mi != 2 || pa != 3 {
		t.Errorf("got %d.%d.%d, want 1.2.3", ma, mi, pa)
	}
}

func TestVersion_FailsWhenBinaryExitsNonZero(t *testing.T) {
	dir := t.TempDir()
	body := `#!/bin/sh
echo "exploded" >&2
exit 3
`
	bin := filepath.Join(dir, "act")
	if err := os.WriteFile(bin, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	_, _, _, err := Version(context.Background())
	if err == nil {
		t.Fatal("expected error when act --version fails")
	}
}

func TestVersion_FailsOnUnparseableOutput(t *testing.T) {
	dir := t.TempDir()
	body := `#!/bin/sh
echo "wat"
`
	bin := filepath.Join(dir, "act")
	if err := os.WriteFile(bin, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))

	_, _, _, err := Version(context.Background())
	if err == nil {
		t.Fatal("expected parse error")
	}
}
