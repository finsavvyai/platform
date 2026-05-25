package clawpipe

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

func writeFixture(t *testing.T, name string, data []byte) string {
	t.Helper()
	dir := t.TempDir()
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, data, 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	return p
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func TestVerifyLlamafileBinary_NotKnown(t *testing.T) {
	path := writeFixture(t, "fictitious-llamafile-x.y.z", []byte("payload"))
	got, err := VerifyLlamafileBinary(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Known {
		t.Fatalf("filename should not be in allow-list, got Known=true")
	}
	if got.Match {
		t.Fatalf("Match must be false when Known is false")
	}
	if got.ComputedSHA256 != sha256Hex([]byte("payload")) {
		t.Fatalf("computed sha mismatch: got %q", got.ComputedSHA256)
	}
}

func TestVerifyLlamafileBinary_KnownMatch(t *testing.T) {
	body := []byte("known-llamafile-bytes")
	expected := sha256Hex(body)
	const fname = "test-llamafile-1.0.0"

	prev := KnownLlamafileSHA256[fname]
	KnownLlamafileSHA256[fname] = expected
	t.Cleanup(func() {
		if prev == "" {
			delete(KnownLlamafileSHA256, fname)
		} else {
			KnownLlamafileSHA256[fname] = prev
		}
	})

	path := writeFixture(t, fname, body)
	got, err := VerifyLlamafileBinary(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !got.Known || !got.Match {
		t.Fatalf("expected Known=true Match=true, got %+v", got)
	}
}

func TestVerifyLlamafileBinary_KnownMismatch(t *testing.T) {
	const fname = "test-llamafile-2.0.0"
	KnownLlamafileSHA256[fname] = "0000000000000000000000000000000000000000000000000000000000000000"
	t.Cleanup(func() { delete(KnownLlamafileSHA256, fname) })

	path := writeFixture(t, fname, []byte("different-bytes"))
	got, err := VerifyLlamafileBinary(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !got.Known {
		t.Fatalf("Known should be true for an explicitly-registered filename")
	}
	if got.Match {
		t.Fatalf("Match should be false when sha differs")
	}
}

func TestVerifyLlamafileBinary_MissingFile(t *testing.T) {
	if _, err := VerifyLlamafileBinary("/nonexistent/path/to/llamafile"); err == nil {
		t.Fatalf("expected error for missing file, got nil")
	}
}

func TestBaseName(t *testing.T) {
	cases := map[string]string{
		"/a/b/c":               "c",
		"a/b/c":                "c",
		"c":                    "c",
		"/foo/llamafile-1.0.0": "llamafile-1.0.0",
		`C:\foo\bar.exe`:       "bar.exe",
	}
	for in, want := range cases {
		if got := baseName(in); got != want {
			t.Errorf("baseName(%q) = %q, want %q", in, got, want)
		}
	}
}
