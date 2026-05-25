package voice

import (
	"context"
	"os"
)

// Narrator is the production-facing facade: pick a persona, get a
// Speaker, fire .Event(...) at run lifecycle hooks. Safe for use
// from cmd_run even when voice is muted — every method short-
// circuits cleanly so callers don't need MuteEnv() wrappers.
type Narrator struct {
	Persona Persona
	Speaker Speaker
	// AI is optional. When set + IsConfigured(), Event() asks the
	// model for one fresh in-character line, falling back to the
	// canned phrase bank on empty/error. nil = always use canned.
	AI AIClient
}

// NewNarrator picks the active persona by precedence:
//  1. explicit `name` argument (when non-empty)
//  2. PUSHCI_VOICE env var
//  3. fallback to deadpan-narrator
//
// Speaker is whatever NewSpeaker returns for the host.
func NewNarrator(name string) *Narrator {
	if name == "" {
		name = os.Getenv("PUSHCI_VOICE")
	}
	if name == "" {
		name = "deadpan-narrator"
	}
	return &Narrator{
		Persona: PersonaByName(name),
		Speaker: NewSpeaker(),
	}
}

// Event renders one phrase for ev. Errors from the underlying
// speaker are intentionally swallowed: a TTS hiccup must never
// fail the user's pipeline.
func (n *Narrator) Event(ctx context.Context, ev Event) {
	if n == nil {
		return
	}
	line := AICommentary(ctx, n.AI, n.Persona, ev, "")
	// AI output gates on the safety filter; reject = canned fallback.
	if line != "" && !SafetyOK(line) {
		line = ""
	}
	if line == "" {
		line = n.Persona.LineFor(ev)
	}
	n.speak(ctx, line)
}

// Say speaks an arbitrary string in the persona's voice. Used by
// `pushci voice say "..."` and future AI-generated commentary.
// Always passes through the redactor first — secrets in user-
// supplied text get scrubbed before they hit a TTS backend.
func (n *Narrator) Say(ctx context.Context, text string) error {
	if n == nil || text == "" {
		return nil
	}
	return n.Speaker.Say(ctx, Redact(text), SayOptions{VoiceID: n.Persona.VoiceID})
}

// speak is the shared utterance path used by Event(). Applies
// redaction last so even canned phrases can't leak something
// from a future stage-name or env-var interpolation.
func (n *Narrator) speak(ctx context.Context, line string) {
	if line == "" {
		return
	}
	_ = n.Speaker.Say(ctx, Redact(line), SayOptions{VoiceID: n.Persona.VoiceID})
}

// ListPersonas exposes the merged built-in + user registry to CLI
// callers (`pushci voice list`).
func ListPersonas() []Persona { return allPersonas() }
