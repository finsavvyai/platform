package migrate

import (
	"fmt"
	"regexp"
	"strings"
)

var varRefPattern = regexp.MustCompile(`\$\{?([A-Z_][A-Z0-9_]*)\}?`)

func extractVarRefs(script, jobName string) []EnvVarRef {
	matches := varRefPattern.FindAllStringSubmatch(script, -1)
	seen := map[string]bool{}
	var refs []EnvVarRef

	for _, m := range matches {
		name := m[1]
		if seen[name] || isBuiltinVar(name) {
			continue
		}
		seen[name] = true

		ref := EnvVarRef{
			Name:   name,
			Source: "script-ref",
			UsedIn: jobName,
		}

		if isLikelySecret(name) {
			ref.IsSecret = true
			ref.Suggestion = fmt.Sprintf("pushci secret set %s <value>", name)
		} else {
			ref.Suggestion = fmt.Sprintf("export %s=<value>  # or add to stage env:", name)
		}
		refs = append(refs, ref)
	}
	return refs
}

func isLikelySecret(name string) bool {
	lower := strings.ToLower(name)
	secrets := []string{"key", "secret", "token", "password", "credential",
		"api_key", "private", "auth", "bearer"}
	for _, s := range secrets {
		if strings.Contains(lower, s) {
			return true
		}
	}
	return false
}

func isBuiltinVar(name string) bool {
	builtins := map[string]bool{
		"CI": true, "CI_COMMIT_SHA": true, "CI_COMMIT_BRANCH": true,
		"CI_PROJECT_DIR": true, "CI_PIPELINE_ID": true,
		"CI_JOB_NAME": true, "CI_JOB_STAGE": true,
		"HOME": true, "PATH": true, "PWD": true, "USER": true,
		"SHELL": true, "NODE_ENV": true, "IMAGE": true,
	}
	return builtins[name]
}

func extractSecretRefs(script, jobName string) []EnvVarRef {
	matches := secretPattern.FindAllStringSubmatch(script, -1)
	seen := map[string]bool{}
	var refs []EnvVarRef
	for _, m := range matches {
		name := m[1]
		if seen[name] {
			continue
		}
		seen[name] = true
		refs = append(refs, EnvVarRef{
			Name: name, Source: "github-secret", UsedIn: jobName,
			IsSecret: true, Suggestion: fmt.Sprintf("pushci secret set %s <value>", name),
		})
	}
	return refs
}

func sanitizeName(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "/", "-")
	return s
}

func itoa(i int) string {
	return fmt.Sprintf("%d", i)
}
