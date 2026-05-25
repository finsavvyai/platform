package clawpipe

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestIsOfflineOnly_TruthyVariants(t *testing.T) {
	cases := map[string]bool{
		"":      false,
		"0":     false,
		"false": false,
		"no":    false,
		"off":   false,
		"1":     true,
		"true":  true,
		"True":  true,
		"YES":   true,
		" on ":  true,
	}
	for in, want := range cases {
		t.Setenv(EnvOfflineOnly, in)
		if got := IsOfflineOnly(); got != want {
			t.Errorf("IsOfflineOnly(%q)=%v, want %v", in, got, want)
		}
	}
}

func TestErrOfflineOnly_IsSentinel(t *testing.T) {
	wrapped := errors.Join(ErrOfflineOnly, errors.New("context"))
	if !errors.Is(wrapped, ErrOfflineOnly) {
		t.Fatal("ErrOfflineOnly must be detectable via errors.Is")
	}
}

func TestBundledLlamafilePath_OverrideHit(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "llamafile-x")
	if err := os.WriteFile(p, []byte("stub"), 0o755); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	t.Setenv(EnvBundledLlamafile, p)

	got, err := BundledLlamafilePath()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != p {
		t.Fatalf("path mismatch: got %q want %q", got, p)
	}
}

func TestBundledLlamafilePath_OverrideMissingFallsThrough(t *testing.T) {
	t.Setenv(EnvBundledLlamafile, "/definitely/not/here/llamafile")

	// No bundled binary next to the test executable; expect an error.
	_, err := BundledLlamafilePath()
	if err == nil {
		t.Fatal("expected error when neither override nor bundled llamafile exists")
	}
}
