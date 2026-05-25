package migrate

import "strings"

func parseJenkinsEnv(envBlock string, result *JenkinsConvertResult) map[string]string {
	globalEnv := map[string]string{}
	if envBlock == "" {
		return globalEnv
	}
	for _, line := range strings.Split(envBlock, "\n") {
		line = strings.TrimSpace(line)
		if !strings.Contains(line, "=") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		val = strings.Trim(val, "'\"")
		if strings.Contains(val, "credentials(") {
			credID := extractParenContent(val)
			result.EnvVarsNeeded = append(result.EnvVarsNeeded, EnvVarRef{
				Name: key, Source: "jenkins-credential", IsSecret: true,
				Suggestion: "pushci secret set " + key + " <value>  (was Jenkins credential: " + credID + ")",
			})
			globalEnv[key] = "$" + key
		} else {
			globalEnv[key] = val
		}
	}
	return globalEnv
}

func parseJenkinsStage(stagesBlock string, stageMatches [][]int, i int, match []int, prevStage string, b *strings.Builder, result *JenkinsConvertResult) string {
	stageName := stagesBlock[match[2]:match[3]]
	bodyStart := match[1]
	bodyEnd := len(stagesBlock)
	if i+1 < len(stageMatches) {
		bodyEnd = stageMatches[i+1][0]
	}
	stageBody := stagesBlock[bodyStart:bodyEnd]
	stepsBlock := extractBlock(stageBody, "steps")
	if stepsBlock == "" {
		return prevStage
	}
	steps := parseShCommands(stepsBlock, stageName, result)
	onlyOn := parseWhenBlock(stageBody)
	if len(steps) == 0 {
		return prevStage
	}
	safe := sanitizeName(stageName)
	b.WriteString("  - name: " + safe + "\n    checks:\n")
	for j, step := range steps {
		b.WriteString("      - name: " + safe + "-" + itoa(j+1) + "\n        run: " + step + "\n")
	}
	if prevStage != "" {
		b.WriteString("    depends_on:\n      - " + prevStage + "\n")
	}
	if len(onlyOn) > 0 {
		b.WriteString("    only_on:\n")
		for _, br := range onlyOn {
			b.WriteString("      - " + br + "\n")
		}
	}
	result.StagesConverted++
	return safe
}
