package main

import (
	"regexp"
	"strings"
)

var yamlSafe = regexp.MustCompile(`^[A-Za-z0-9_./:@=+\-]+$`)

func yamlQuote(v string) string {
	if v == "" {
		return "''"
	}
	if yamlSafe.MatchString(v) {
		return v
	}
	escaped := strings.ReplaceAll(v, `\`, `\\`)
	escaped = strings.ReplaceAll(escaped, `"`, `\"`)
	return `"` + escaped + `"`
}

func renderPushciYAML(p jenkinsPipeline) string {
	var b strings.Builder
	b.WriteString("# Imported from Jenkinsfile by PushCI\n")
	for _, w := range p.Warnings {
		b.WriteString("# WARNING: " + w + "\n")
	}
	b.WriteString("version: '1'\n")
	b.WriteString("name: " + yamlQuote(p.Name) + "\n")
	b.WriteString("stack: " + p.Stack + "\n")
	if len(p.Env) > 0 {
		b.WriteString("env:\n")
		for k, v := range p.Env {
			b.WriteString("  " + k + ": " + yamlQuote(v) + "\n")
		}
	}
	b.WriteString("stages:\n")
	if len(p.Stages) == 0 {
		b.WriteString("  # no stages detected — review the source Jenkinsfile\n")
	}
	for _, s := range p.Stages {
		renderStage(&b, s)
	}
	renderHooks(&b, p)
	return b.String()
}

func renderStage(b *strings.Builder, s jenkinsStage) {
	b.WriteString("  - name: " + yamlQuote(s.Name) + "\n")
	if len(s.Steps) == 0 {
		b.WriteString("    run: []\n")
		return
	}
	b.WriteString("    run:\n")
	for _, step := range s.Steps {
		b.WriteString("      - " + yamlQuote(step) + "\n")
	}
}

func renderHooks(b *strings.Builder, p jenkinsPipeline) {
	if len(p.OnFail) == 0 && len(p.OnSucc) == 0 {
		return
	}
	b.WriteString("hooks:\n")
	if len(p.OnFail) > 0 {
		b.WriteString("  on_failure:\n")
		for _, s := range p.OnFail {
			b.WriteString("    - " + yamlQuote(s) + "\n")
		}
	}
	if len(p.OnSucc) > 0 {
		b.WriteString("  on_success:\n")
		for _, s := range p.OnSucc {
			b.WriteString("    - " + yamlQuote(s) + "\n")
		}
	}
}
