package main

import "regexp"

// extractBlock finds `label { ... }` and returns the inner body with
// balanced braces. Empty string when absent.
func extractBlock(source, label string) string {
	re := regexp.MustCompile(`\b` + regexp.QuoteMeta(label) + `\b\s*\{`)
	loc := re.FindStringIndex(source)
	if loc == nil {
		return ""
	}
	start := loc[1]
	depth := 1
	for i := start; i < len(source); i++ {
		switch source[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return source[start:i]
			}
		}
	}
	return ""
}

var stageHdrRe = regexp.MustCompile(`\bstage\s*\(\s*(?:'([^']*)'|"([^"]*)")\s*\)\s*\{`)

func parseStages(stagesBody string) []jenkinsStage {
	var out []jenkinsStage
	rest := stagesBody
	for {
		loc := stageHdrRe.FindStringSubmatchIndex(rest)
		if loc == nil {
			break
		}
		name := stageName(rest, loc)
		start := loc[1]
		end := scanStageEnd(rest, start)
		inner := rest[start : end-1]
		stepsBody := extractBlock(inner, "steps")
		if stepsBody == "" {
			stepsBody = inner
		}
		out = append(out, jenkinsStage{Name: name, Steps: parseShSteps(stepsBody)})
		rest = rest[end:]
	}
	return out
}

func stageName(rest string, loc []int) string {
	if loc[2] >= 0 {
		return rest[loc[2]:loc[3]]
	}
	if loc[4] >= 0 {
		return rest[loc[4]:loc[5]]
	}
	return ""
}

func scanStageEnd(rest string, start int) int {
	depth := 1
	end := start
	for end < len(rest) && depth > 0 {
		switch rest[end] {
		case '{':
			depth++
		case '}':
			depth--
		}
		end++
		if depth == 0 {
			break
		}
	}
	return end
}
