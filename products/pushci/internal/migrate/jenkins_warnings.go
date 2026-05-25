package migrate

import (
	"regexp"
	"strings"
)

// notePostBlock emits a warning when the pipeline has a `post { ... }`
// section. PushCI has no post-block equivalent yet, so we surface the
// unmigrated hook names (always/success/failure/unstable) with a hint.
func notePostBlock(raw string, result *JenkinsConvertResult) {
	post := extractBlock(raw, "post")
	if post == "" {
		return
	}
	hooks := []string{}
	for _, h := range []string{"always", "success", "failure", "unstable", "changed", "aborted", "fixed"} {
		if regexp.MustCompile(`(?m)^\s*`+h+`\s*\{`).FindStringIndex(post) != nil {
			hooks = append(hooks, h)
		}
	}
	if len(hooks) == 0 {
		return
	}
	result.Warnings = append(result.Warnings,
		"post { "+strings.Join(hooks, ", ")+" } — PushCI has no post-block equivalent; add cleanup to a final stage manually")
}

// noteParallelAndMatrix flags constructs PushCI can't auto-expand. A
// `parallel { stage: … }` becomes a warning suggesting the user set
// `parallel: true` on related stages. A `matrix { axes: … }` warns
// because cross-product expansion is tricky without a full Groovy parser.
func noteParallelAndMatrix(raw string, result *JenkinsConvertResult) {
	if regexp.MustCompile(`(?m)parallel\s*\{`).FindStringIndex(raw) != nil {
		result.Warnings = append(result.Warnings,
			"parallel { ... } block detected — set `parallel: true` on the grouped PushCI stages manually")
	}
	if regexp.MustCompile(`(?m)matrix\s*\{`).FindStringIndex(raw) != nil {
		result.Warnings = append(result.Warnings,
			"matrix { axes: ... } detected — expand cross-product manually into one stage per axis combination")
	}
}

// noteWithCredentials scans for withCredentials([...]) bindings and
// emits `pushci secret set` hints for each credential variable. Handles
// the common bindings: string, usernamePassword, file, sshUserPrivateKey.
func noteWithCredentials(raw string, result *JenkinsConvertResult) {
	pat := regexp.MustCompile(`(?:variable|usernameVariable|passwordVariable|keyFileVariable)\s*:\s*['"]([A-Z_][A-Z0-9_]*)['"]`)
	seen := map[string]bool{}
	for _, m := range pat.FindAllStringSubmatch(raw, -1) {
		name := m[1]
		if seen[name] {
			continue
		}
		seen[name] = true
		result.EnvVarsNeeded = append(result.EnvVarsNeeded, EnvVarRef{
			Name: name, Source: "jenkins-withCredentials", IsSecret: true,
			Suggestion: "pushci secret set " + name + " <value>  (was withCredentials binding)",
		})
	}
}
