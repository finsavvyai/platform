// Package voice provides text-to-speech narration for PushCI runs.
// Phase 1 ships a macOS `say` backend + four built-in personas
// (larry-david, michael-scott, gilfoyle, deadpan-narrator) with
// pre-canned per-event phrase banks. AI-generated commentary and
// premium TTS backends slot in behind the same Speaker interface.
package voice

import (
	"context"
	"os"
)

// Speaker abstracts a text-to-speech backend so cmd_run can call
// Say(...) without caring whether the bytes come from macOS `say`,
// Piper, or ElevenLabs. Backends MUST be safe to call concurrently
// — pushci run can fire multiple stage events back-to-back.
type Speaker interface {
	Say(ctx context.Context, text string, opts SayOptions) error
	Name() string
}

// SayOptions carries per-utterance overrides chosen by the persona
// (e.g. which macOS voice to use, speech rate, output file). All
// fields optional — backends fill sane defaults.
type SayOptions struct {
	VoiceID string  // backend-specific identifier, e.g. macOS "Daniel"
	Rate    int     // words per minute; 0 = backend default
	OutFile string  // when non-empty, write audio to this path
	Volume  float32 // 0.0–1.0; 0 = backend default
}

// NewSpeaker returns the default speaker for the host. macOS uses
// the system `say` binary; Linux and Windows currently fall back
// to a no-op Speaker that prints lines to stderr so callers stay
// platform-portable until Piper/Voicebox lands.
func NewSpeaker() Speaker {
	if _, err := exec("which", "say"); err == nil {
		return &macSay{}
	}
	return &textSpeaker{out: os.Stderr}
}

// MuteEnv reports whether the user has muted voice output via
// PUSHCI_VOICE_OFF=1. Honored by every Speaker implementation so
// CI logs stay quiet without code changes.
func MuteEnv() bool {
	v := os.Getenv("PUSHCI_VOICE_OFF")
	return v == "1" || v == "true" || v == "yes"
}
