package migrate

import (
	"regexp"
	"strings"
)

// JenkinsConvertResult holds the migration output.
type JenkinsConvertResult struct {
	PushCIYAML      string
	StagesConverted int
	StepsKept       int
	Warnings        []string
	EnvVarsNeeded   []EnvVarRef
}

// ConvertJenkinsfile converts a Jenkinsfile to PushCI. Handles both
// declarative (`pipeline { ... }`) and scripted (`node { ... }`) forms.
// Scripted support is best-effort: we extract `stage('X') { sh '…' }`
// blocks and warn on everything else.
func ConvertJenkinsfile(raw string) *JenkinsConvertResult {
	result := &JenkinsConvertResult{}
	noteWithCredentials(raw, result)
	noteParallelAndMatrix(raw, result)
	notePostBlock(raw, result)

	if !looksDeclarative(raw) {
		convertScripted(raw, result)
		return result
	}

	if agent := extractBlock(raw, "agent"); agent != "" {
		if strings.Contains(agent, "docker") {
			if img := extractQuoted(agent); img != "" {
				result.Warnings = append(result.Warnings,
					"Agent uses Docker image: "+img+" — ensure available locally (pushci runs on host)")
			}
		}
	}

	envBlock := extractBlock(raw, "environment")
	globalEnv := parseJenkinsEnv(envBlock, result)

	stagesBlock := extractBlock(raw, "stages")
	if stagesBlock == "" {
		result.Warnings = append(result.Warnings, "No stages block found — is this a declarative Jenkinsfile?")
		return result
	}

	stagePattern := regexp.MustCompile(`stage\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\{`)
	stageMatches := stagePattern.FindAllStringSubmatchIndex(stagesBlock, -1)

	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")

	prevStage := ""
	for i, match := range stageMatches {
		prevStage = parseJenkinsStage(stagesBlock, stageMatches, i, match, prevStage, &b, result)
	}

	appendJenkinsEnvWarnings(globalEnv, result)
	result.PushCIYAML = b.String()
	return result
}
