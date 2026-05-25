package voice

import "strings"

// intentRules maps spoken keywords to canonical pushci verbs.
// Match-order matters — most-specific phrases first so "rollback
// the deploy" maps to rollback, not deploy.
var intentRules = []struct {
	verb     string
	keywords []string
}{
	{"rollback", []string{"rollback", "roll back", "revert", "undo deploy"}},
	{"status", []string{"status", "what's the status", "show me", "current state"}},
	{"deploy", []string{"deploy", "ship it", "push to prod", "release"}},
	{"run", []string{"run pipeline", "run ci", "run tests", "kick off"}},
}

// ParseIntent looks for known verb keywords in the transcript.
// Confidence is a coarse heuristic: 1.0 for direct verb match,
// 0.7 for multi-word phrase match. Unknown text returns
// {Verb:"", Confidence:0} — caller should print the transcript
// and ask the user what to do, not auto-dispatch.
func ParseIntent(text string) Intent {
	lower := strings.ToLower(strings.TrimSpace(text))
	if lower == "" {
		return Intent{}
	}
	for _, rule := range intentRules {
		for _, kw := range rule.keywords {
			if !strings.Contains(lower, kw) {
				continue
			}
			conf := 0.7
			if lower == kw || strings.HasPrefix(lower, kw+" ") || strings.HasSuffix(lower, " "+kw) {
				conf = 1.0
			}
			return Intent{Verb: rule.verb, Confidence: conf}
		}
	}
	return Intent{}
}
