package main

import (
	"context"
	"os"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/voice"
)

// voiceStartEvent is the lifecycle moment we narrate when cmdRun
// begins. Defined as a function so tests can stub the event mapping
// without reaching into the voice package.
func voiceStartEvent() voice.Event { return voice.EventStart }

// runNarrator is the active per-run voice. Lazily initialized on
// first use so cmd_run_voice stays a no-op when the user didn't
// pass --voice. Persona resolved by NewNarrator (PUSHCI_VOICE env
// or "deadpan-narrator" fallback).
var runNarrator *voice.Narrator

func ensureNarrator() *voice.Narrator {
	if runNarrator == nil {
		runNarrator = voice.NewNarrator("")
		if v := os.Getenv("PUSHCI_VOICE_AI"); v == "1" || v == "true" {
			runNarrator.AI = ai.NewClient()
		}
	}
	return runNarrator
}

// narrateEvent fires a persona-driven phrase for the lifecycle
// event when --voice is on. Errors are swallowed inside Narrator
// so callers don't need defensive wrappers.
func narrateEvent(ctx context.Context, on bool, ev voice.Event) {
	if !on {
		return
	}
	ensureNarrator().Event(ctx, ev)
}

// speakResult fires EventPass / EventFail at run-finish time.
// Kept as the legacy entry point because onFinish (cmd_run_help.go)
// already calls it from a deferred closure.
//
// Failure roast hook: when AI is wired (PUSHCI_VOICE_AI=1) and the
// run failed, ask the persona for an in-character roast of the
// recent diff before falling back to the canned EventFail line.
// Diff context piped through Redact() upstream — same safety
// guarantees as `pushci voice joke`.
func speakResult(passed bool, elapsed string) {
	n := ensureNarrator()
	if !passed && n.AI != nil && n.AI.IsConfigured() {
		if line := voice.JokeAboutDiff(context.Background(), n.AI, n.Persona, "HEAD~1"); line != "" {
			_ = n.Say(context.Background(), line)
			return
		}
	}
	ev := voice.EventPass
	if !passed {
		ev = voice.EventFail
	}
	n.Event(context.Background(), ev)
}
