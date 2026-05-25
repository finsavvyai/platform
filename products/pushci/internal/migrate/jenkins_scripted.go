package migrate

import (
	"regexp"
	"strings"
)

// looksDeclarative reports whether raw opens with a `pipeline {` block
// (possibly preceded by comments or `@Library` annotations). When false,
// callers should fall back to the scripted-pipeline best-effort path.
func looksDeclarative(raw string) bool {
	pat := regexp.MustCompile(`(?m)^\s*pipeline\s*\{`)
	return pat.FindStringIndex(raw) != nil
}

// convertScripted handles `node { stage('X') { sh '…' } }` blocks by
// extracting stage names and their `sh` commands. Anything outside a
// stage is surfaced as a warning — we never want a silent drop of
// user-authored steps.
func convertScripted(raw string, result *JenkinsConvertResult) {
	result.Warnings = append(result.Warnings,
		"Scripted pipeline detected — best-effort stage extraction only. "+
			"Review the generated pushci.yml and re-add any non-stage logic manually.")
	stagePattern := regexp.MustCompile(`stage\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\{`)
	matches := stagePattern.FindAllStringSubmatchIndex(raw, -1)
	if len(matches) == 0 {
		result.Warnings = append(result.Warnings,
			"No stage('…') blocks found in scripted pipeline — nothing to import")
		return
	}
	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")
	prev := ""
	for i, m := range matches {
		prev = writeScriptedStage(raw, matches, i, m, prev, &b, result)
	}
	result.PushCIYAML = b.String()
}

// writeScriptedStage emits one stage from a scripted-pipeline stage()
// call. Returns the safe-name so the next stage can depends_on it.
func writeScriptedStage(raw string, matches [][]int, i int, m []int, prev string, b *strings.Builder, result *JenkinsConvertResult) string {
	name := raw[m[2]:m[3]]
	bodyStart := m[1]
	bodyEnd := len(raw)
	if i+1 < len(matches) {
		bodyEnd = matches[i+1][0]
	}
	safe := sanitizeName(name)
	steps := parseShCommands(raw[bodyStart:bodyEnd], name, result)
	if len(steps) == 0 {
		return prev
	}
	b.WriteString("  - name: " + safe + "\n    checks:\n")
	for j, s := range steps {
		b.WriteString("      - name: " + safe + "-" + itoa(j+1) + "\n        run: " + s + "\n")
	}
	if prev != "" {
		b.WriteString("    depends_on:\n      - " + prev + "\n")
	}
	result.StagesConverted++
	return safe
}
