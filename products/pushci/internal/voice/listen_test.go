package voice

import (
	"context"
	osexec "os/exec"
	"strings"
	"testing"
)

func TestListen_NoSox_ClearError(t *testing.T) {
	t.Setenv("PATH", t.TempDir())
	t.Setenv("GROQ_API_KEY", "fake-key-for-test")
	_, err := Listen(context.Background(), 1)
	if err == nil || !strings.Contains(err.Error(), "sox") {
		t.Fatalf("expected sox-missing error; got %v", err)
	}
}

func TestListen_NoGroqKey_ClearError(t *testing.T) {
	if _, err := osexec.LookPath("sox"); err != nil {
		t.Skip("sox not on PATH; skipping (covered by TestListen_NoSox_ClearError)")
	}
	t.Setenv("GROQ_API_KEY", "")
	_, err := Listen(context.Background(), 1)
	if err == nil || !strings.Contains(err.Error(), "GROQ_API_KEY") {
		t.Fatalf("expected GROQ_API_KEY error; got %v", err)
	}
}
