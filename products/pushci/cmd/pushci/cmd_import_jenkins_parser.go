package main

import (
	"regexp"
	"strings"
)

// Jenkinsfile → .pushci.yml regex-based translator. Self-contained so
// `pushci import jenkins` can parse locally without calling the API.
// Mirrors api/src/jenkins-importer.ts — keep the two in lockstep if
// the declarative subset grows.

type jenkinsStage struct {
	Name  string
	Steps []string
}

type jenkinsPipeline struct {
	Name     string
	Stack    string
	Env      map[string]string
	Stages   []jenkinsStage
	OnFail   []string
	OnSucc   []string
	Warnings []string
}

var (
	commentLineRe  = regexp.MustCompile(`(?m)^\s*//.*$`)
	commentBlockRe = regexp.MustCompile(`(?s)/\*.*?\*/`)
)

func parseJenkinsfile(source string) jenkinsPipeline {
	clean := commentBlockRe.ReplaceAllString(source, "")
	clean = commentLineRe.ReplaceAllString(clean, "")

	body := extractBlock(clean, "pipeline")
	if body == "" {
		body = clean
	}

	pipe := jenkinsPipeline{Name: "jenkins-import", Stack: "unknown", Env: map[string]string{}}
	if envBody := extractBlock(body, "environment"); envBody != "" {
		pipe.Env = parseEnvBlock(envBody)
	}
	if stagesBody := extractBlock(body, "stages"); stagesBody != "" {
		pipe.Stages = parseStages(stagesBody)
	} else {
		pipe.Warnings = append(pipe.Warnings, "no 'stages' block found — is this a scripted pipeline?")
	}
	if postBody := extractBlock(body, "post"); postBody != "" {
		if f := extractBlock(postBody, "failure"); f != "" {
			pipe.OnFail = parseShSteps(f)
		}
		if s := extractBlock(postBody, "success"); s != "" {
			pipe.OnSucc = parseShSteps(s)
		}
	}
	pipe.Stack = detectJenkinsStack(pipe.Stages)
	return pipe
}

func detectJenkinsStack(stages []jenkinsStage) string {
	var all []string
	for _, s := range stages {
		all = append(all, s.Steps...)
	}
	joined := strings.Join(all, "\n")
	switch {
	case regexp.MustCompile(`\bmvn\b|mvnw`).MatchString(joined):
		return "java-maven"
	case regexp.MustCompile(`\bgradle\b|gradlew`).MatchString(joined):
		return "java-gradle"
	case regexp.MustCompile(`\bnpm\b|\bpnpm\b|\byarn\b`).MatchString(joined):
		return "node"
	case regexp.MustCompile(`\bpytest\b|\bpython\b|\bpip\b`).MatchString(joined):
		return "python"
	}
	return "unknown"
}
