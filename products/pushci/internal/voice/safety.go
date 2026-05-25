package voice

import (
	"regexp"
	"strings"
)

// SafetyOK reports whether s is safe to speak. AI-generated
// commentary goes through this filter before it reaches a TTS
// backend or a future shareable-clip recorder. False = drop the
// line and fall back to the persona's canned phrase bank.
//
// Filter is intentionally conservative: profanity, slurs, real-
// world celebrity names, and prompt-injection echo patterns. We
// do NOT try to rewrite — too risky. Just reject + fall back.
func SafetyOK(s string) bool {
	lower := strings.ToLower(s)
	for _, w := range blockedWords {
		if strings.Contains(lower, w) {
			return false
		}
	}
	for _, re := range blockedPatterns {
		if re.MatchString(lower) {
			return false
		}
	}
	return true
}

// blockedWords is a tiny seed list of strings that should never
// leave a TTS backend regardless of persona. Conservative on
// purpose: a longer list belongs in a config file the user can
// tune, not hard-coded in a Go binary.
var blockedWords = []string{
	"fuck", "shit", "cunt", "bitch", "asshole",
	// real-person identifiers we explicitly want to avoid
	// emitting verbatim — rebrand handles persona names, this
	// catches model leakage.
	"larry david", "michael scott", "bertram gilfoyle",
}

// blockedPatterns catch prompt-injection echo where the model
// regurgitates the system prompt or another instruction wrapper.
// Detected by keywords that should never appear in a one-line
// stand-up bit (system, ignore previous, you are now, etc).
var blockedPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b(ignore (?:previous|all) (?:instructions?|prompts?))`),
	regexp.MustCompile(`(?i)\bsystem prompt\b`),
	regexp.MustCompile(`(?i)\byou are now\b`),
	regexp.MustCompile(`(?i)\bdisregard\s+(?:previous|the above)\b`),
}
