package nlp

import "strings"

// compoundSeparators are phrases that split a compound command.
var compoundSeparators = []string{" and then ", " then ", " after that ", " and "}

// ParseCompound splits a compound command into individual sub-commands.
// "deploy and scan tenants" -> ["deploy", "scan tenants"]
func ParseCompound(input string) []string {
	lower := strings.ToLower(strings.TrimSpace(input))
	parts := splitOnSeparators(lower, compoundSeparators)
	cleaned := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	if len(cleaned) == 0 {
		return []string{input}
	}
	return cleaned
}

// MatchCompound parses a compound command and matches each part to actions.
func MatchCompound(input string) []*Action {
	parts := ParseCompound(input)
	actions := make([]*Action, 0, len(parts))
	for _, part := range parts {
		action := matchPattern(part)
		if action != nil {
			actions = append(actions, action)
		}
	}
	return actions
}

func splitOnSeparators(input string, separators []string) []string {
	// Try each separator in order of specificity (longest first)
	for _, sep := range separators {
		if strings.Contains(input, sep) {
			return splitRecursive(input, sep, separators)
		}
	}
	return []string{input}
}

func splitRecursive(input, sep string, allSeps []string) []string {
	idx := strings.Index(input, sep)
	if idx < 0 {
		return []string{input}
	}
	left := input[:idx]
	right := input[idx+len(sep):]

	result := []string{left}
	// Recursively split the remainder
	rightParts := splitOnSeparators(right, allSeps)
	result = append(result, rightParts...)
	return result
}
