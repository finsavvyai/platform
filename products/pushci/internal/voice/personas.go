package voice

import "math/rand"

// Persona binds a name to a TTS voice ID and per-event phrase
// banks. Phase 1 is fully offline — we never call an LLM for the
// text, just pick a random pre-canned line per event so latency
// stays at "say-binary launch time" (~50ms).
type Persona struct {
	Name        string
	VoiceID     string // macOS voice; backends may translate
	Description string
	Phrases     map[Event][]string
}

// Event names a moment in pushci run that may trigger narration.
type Event string

const (
	EventStart    Event = "start"
	EventStage    Event = "stage"
	EventPass     Event = "pass"
	EventFail     Event = "fail"
	EventDeploy   Event = "deploy"
	EventRollback Event = "rollback"
)

// LineFor returns a random phrase for ev, falling back to "" when
// the persona has nothing wired for that event. Caller skips the
// utterance on empty (no awkward silence-then-error).
func (p *Persona) LineFor(ev Event) string {
	bank := p.Phrases[ev]
	if len(bank) == 0 {
		return ""
	}
	return bank[rand.Intn(len(bank))] // #nosec G404 -- phrase picker, not security
}
