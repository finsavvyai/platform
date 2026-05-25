package voice

import "strings"

// deadpanNarrator: straight news anchor / nature documentary.
// Safe default — no opinion, no humor, just facts. Picked when
// users want voice on but no character. Voice "Samantha" is the
// classic neutral US female macOS voice.
var deadpanNarrator = Persona{
	Name:        "deadpan-narrator",
	VoiceID:     "Samantha",
	Description: "Neutral narrator — facts only, no character",
	Phrases: map[Event][]string{
		EventStart: {
			"Pipeline starting.",
			"Beginning the run.",
		},
		EventStage: {
			"Stage starting.",
			"Next stage.",
		},
		EventPass: {
			"Stage passed.",
			"Tests passed.",
		},
		EventFail: {
			"Stage failed.",
			"A check has failed.",
		},
		EventDeploy: {
			"Deployment complete.",
			"Now live in production.",
		},
		EventRollback: {
			"Rolling back.",
			"Reverting deployment.",
		},
	},
}

// builtinPersonas returns the four phase-1 personas in stable
// order. Tests rely on this ordering.
func builtinPersonas() []Persona {
	return []Persona{larryDavid, michaelScott, gilfoyle, deadpanNarrator}
}

// allPersonas merges built-in personas with anything the user has
// declared in ~/.pushci/voices.yml. User entries with the same
// Name as a built-in win — that's how a community-published
// "curb-style" override could replace the default phrase bank.
func allPersonas() []Persona {
	user := LoadUserPersonas()
	out := append([]Persona{}, user...)
	seen := map[string]bool{}
	for _, p := range user {
		seen[strings.ToLower(p.Name)] = true
	}
	for _, p := range builtinPersonas() {
		if seen[strings.ToLower(p.Name)] {
			continue
		}
		out = append(out, p)
	}
	return out
}
