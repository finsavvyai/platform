package nlp

func patternDeploy(input string) *Action {
	target := extractAfter(input, "deploy to ")
	if target == "" {
		target = extractAfter(input, "deploy this to ")
	}
	return &Action{Type: "deploy", Params: map[string]string{"target": target}}
}

func patternDiagnose(_ string) *Action {
	return &Action{Type: "diagnose", Params: map[string]string{}}
}

func patternRunTests(_ string) *Action {
	return &Action{Type: "run", Params: map[string]string{"checks": "test"}}
}

func patternRunLint(_ string) *Action {
	return &Action{Type: "run", Params: map[string]string{"checks": "lint"}}
}

func patternRunAll(_ string) *Action {
	return &Action{Type: "run", Params: map[string]string{}}
}

func patternStatus(_ string) *Action {
	return &Action{Type: "status", Params: map[string]string{}}
}

func patternSetSecret(_ string) *Action {
	return &Action{Type: "secret", Params: map[string]string{"operation": "set"}}
}

func patternListSecret(_ string) *Action {
	return &Action{Type: "secret", Params: map[string]string{"operation": "list"}}
}

func patternOptimize(_ string) *Action {
	return &Action{Type: "optimize", Params: map[string]string{}}
}

func patternFixPipe(_ string) *Action {
	return &Action{Type: "fix_pipeline", Params: map[string]string{}}
}

func patternGenerate(_ string) *Action {
	return &Action{Type: "generate", Params: map[string]string{}}
}

func patternHeal(_ string) *Action {
	return &Action{Type: "heal", Params: map[string]string{}}
}
