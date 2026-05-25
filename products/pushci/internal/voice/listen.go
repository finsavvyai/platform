package voice

import (
	"context"
	"fmt"
	"os"
	osexec "os/exec"
	"path/filepath"
	"strconv"
	"time"
)

// ListenResult is what `pushci voice listen` returns to the CLI:
// the raw transcript and the parsed Intent. Caller decides whether
// to dispatch (with confirmation) or just print.
type ListenResult struct {
	Transcript string
	Intent     Intent
}

// Intent is the matched voice command — empty Verb means we
// understood the words but they didn't map to a known operation.
// Confidence is 0..1 from a simple keyword match (no model call);
// always treat <0.5 as "ask the user before dispatching".
type Intent struct {
	Verb       string // "deploy", "rollback", "status", "run"
	Confidence float64
}

// CaptureSeconds is the recording duration default. Kept short so
// users don't sit silent waiting; long-form dictation isn't the
// goal of this feature.
const CaptureSeconds = 4

// Listen records audio for `seconds` (default 4), transcribes via
// Groq Whisper, and parses an intent. Returns clear errors when
// `sox` (recorder) or GROQ_API_KEY are missing — both expected
// to be set explicitly by the user before this command works.
func Listen(ctx context.Context, seconds int) (*ListenResult, error) {
	if seconds <= 0 {
		seconds = CaptureSeconds
	}
	if _, err := osexec.LookPath("sox"); err != nil {
		return nil, fmt.Errorf("voice listen: sox not found on PATH (install: brew install sox)")
	}
	if os.Getenv("GROQ_API_KEY") == "" {
		return nil, fmt.Errorf("voice listen: GROQ_API_KEY required for Whisper transcription")
	}
	tmp, err := captureAudio(ctx, seconds)
	if err != nil {
		return nil, err
	}
	defer os.Remove(tmp)
	text, err := transcribeGroq(ctx, tmp)
	if err != nil {
		return nil, err
	}
	return &ListenResult{Transcript: text, Intent: ParseIntent(text)}, nil
}

func captureAudio(ctx context.Context, seconds int) (string, error) {
	dir, err := os.MkdirTemp("", "pushci-listen-*")
	if err != nil {
		return "", fmt.Errorf("voice listen: tmpdir: %w", err)
	}
	out := filepath.Join(dir, "in.wav")
	cmd := osexec.CommandContext(ctx, "sox",
		"-d", "-r", "16000", "-c", "1", "-b", "16", out,
		"trim", "0", strconv.Itoa(seconds),
	)
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		os.RemoveAll(dir)
		return "", fmt.Errorf("voice listen: sox capture: %w", err)
	}
	return out, nil
}

// timeoutForTranscription bounds the Groq HTTP call. Whisper-large
// returns in ~1s on a 4s clip; 30s catches network jitter.
const timeoutForTranscription = 30 * time.Second
