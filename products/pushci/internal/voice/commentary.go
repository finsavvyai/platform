package voice

import (
	"context"
	"strings"
)

// AIClient is the narrow interface Narrator needs from internal/ai
// to generate fresh per-event commentary. Defined locally so the
// voice package doesn't import internal/ai directly — the cmd
// layer wires the real client at startup. Keeps this package
// dep-free for tests.
type AIClient interface {
	IsConfigured() bool
	AskWithSystem(ctx context.Context, system, prompt string) (string, error)
}

// AICommentary asks the configured LLM for one fresh in-character
// line for the given event. Returns "" when no AI is configured,
// the call fails, or the response is suspiciously long — caller
// then falls back to the canned phrase bank.
//
// Prompt is intentionally minimal: persona description + event +
// optional context. We do NOT pass the diff here; that's a phase
// 3 enhancement once we want the joke to reference the actual code.
func AICommentary(ctx context.Context, ai AIClient, p Persona, ev Event, hint string) string {
	if ai == nil || !ai.IsConfigured() {
		return ""
	}
	out, err := ai.AskWithSystem(ctx, personaSystemPrompt(p), eventPrompt(ev, hint))
	if err != nil {
		return ""
	}
	return sanitizeAILine(out)
}

// personaSystemPrompt frames the model as the persona. Style cues
// are short on purpose — long instructions push the model toward
// safer, blander output.
func personaSystemPrompt(p Persona) string {
	return "You are " + p.Name + ", commenting on a CI/CD pipeline. " +
		"Style: " + p.Description + ". " +
		"Reply with ONE short spoken sentence — no quotes, no preamble, " +
		"no emoji, under 20 words. Stay in character."
}

// eventPrompt is the user-side prompt; tiny by design. Hint is an
// optional short phrase like "stage 'deploy-to-ecs' just passed"
// for cases where the canned phrase couldn't capture the moment.
func eventPrompt(ev Event, hint string) string {
	base := "The pipeline event is: " + string(ev) + "."
	if hint != "" {
		base += " Context: " + hint
	}
	return base + " Give one line of commentary."
}

// sanitizeAILine trims whitespace, strips wrapping quotes, drops
// the line entirely if the model returned a multi-paragraph reply
// (signals it ignored "ONE short spoken sentence"). Length-capped
// so a runaway model can't make `say` chew on a 5KB monologue.
func sanitizeAILine(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, `"'`)
	if strings.Count(s, "\n") > 1 || len(s) > 280 {
		return ""
	}
	return s
}
