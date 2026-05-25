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
	{keywords: []string{"deploy to ", "deploy this to "}, toAction: patternDeploy},
	{keywords: []string{"why did", "build fail", "diagnose", "what went wrong"}, toAction: patternDiagnose},
	{keywords: []string{"run tests", "run only tests", "run test"}, toAction: patternRunTests},
	{keywords: []string{"run lint", "run linter"}, toAction: patternRunLint},
	{keywords: []string{"run pipeline", "run ci", "run all", "run checks"}, toAction: patternRunAll},
	{keywords: []string{"status", "last run", "how did"}, toAction: patternStatus},
	{keywords: []string{"set secret", "store secret", "add secret"}, toAction: patternSetSecret},
	{keywords: []string{"list secret"}, toAction: patternListSecret},
	{keywords: []string{"optimize", "speed up", "make faster", "reduce cost"}, toAction: patternOptimize},
	{keywords: []string{"fix my pipeline", "fix pipeline", "repair pipeline"}, toAction: patternFixPipe},
	{keywords: []string{"generate pipeline", "create pipeline", "init pipeline"}, toAction: patternGenerate},
	{keywords: []string{"heal", "self-heal", "auto-fix", "autofix"}, toAction: patternHeal},
}

func extractAfter(input, prefix string) string {
	idx := strings.Index(input, prefix)
	if idx < 0 {
		return ""
	}
	rest := strings.TrimSpace(input[idx+len(prefix):])
	if i := strings.IndexByte(rest, ' '); i > 0 {
		rest = rest[:i]
	}
	return strings.Trim(rest, `"'`)
}
