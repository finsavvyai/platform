package nlp

import "strings"

// matchPattern tries to match input to an action without AI.
func matchPattern(input string) *Action {
	lower := strings.ToLower(strings.TrimSpace(input))
	for _, p := range knownPatterns {
		for _, keyword := range p.keywords {
			if strings.Contains(lower, keyword) {
				return p.toAction(lower)
			}
		}
	}
	return nil
}

type pattern struct {
	keywords []string
	toAction func(input string) *Action
}

var knownPatterns = []pattern{
	{
		keywords: []string{"deploy to ", "deploy this to "},
		toAction: func(input string) *Action {
			target := extractAfter(input, "deploy to ")
			if target == "" {
				target = extractAfter(input, "deploy this to ")
			}
			return &Action{Type: "deploy", Params: map[string]string{"target": target}}
		},
	},
	{
		keywords: []string{"why did", "build fail", "diagnose", "what went wrong"},
		toAction: func(_ string) *Action {
			return &Action{Type: "diagnose", Params: map[string]string{}}
		},
	},
	{
		keywords: []string{"run tests", "run only tests", "run test"},
		toAction: func(_ string) *Action {
			return &Action{Type: "run", Params: map[string]string{"checks": "test"}}
		},
	},
	{
		keywords: []string{"run lint", "run linter"},
		toAction: func(_ string) *Action {
			return &Action{Type: "run", Params: map[string]string{"checks": "lint"}}
		},
	},
	{
		keywords: []string{"run pipeline", "run ci", "run all", "run checks"},
		toAction: func(_ string) *Action {
			return &Action{Type: "run", Params: map[string]string{}}
		},
	},
	{
		keywords: []string{"status", "last run", "how did"},
		toAction: func(_ string) *Action {
			return &Action{Type: "status", Params: map[string]string{}}
		},
	},
	{
		keywords: []string{"set secret", "store secret", "add secret"},
		toAction: func(input string) *Action {
			return &Action{Type: "secret", Params: map[string]string{"operation": "set"}}
		},
	},
	{
		keywords: []string{"list secret"},
		toAction: func(_ string) *Action {
			return &Action{Type: "secret", Params: map[string]string{"operation": "list"}}
		},
	},
}

func extractAfter(input, prefix string) string {
	idx := strings.Index(input, prefix)
	if idx < 0 {
		return ""
	}
	rest := strings.TrimSpace(input[idx+len(prefix):])
	// Take first word or quoted string
	if i := strings.IndexByte(rest, ' '); i > 0 {
		rest = rest[:i]
	}
	return strings.Trim(rest, `"'`)
}
