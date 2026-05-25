package migrate

// warnEmptyJob flags a job whose only contribution is `stage:` — no
// before_script / script / after_script. The common cause is GitLab
// template includes (Security/SAST, container scanning, etc.).
func warnEmptyJob(result *GitLabConvertResult, name string) {
	result.Warnings = append(result.Warnings,
		"Job '"+name+"' has no script — likely uses `include:` "+
			"template only (e.g. Security/SAST). PushCI cannot "+
			"resolve GitLab template includes; replace with the "+
			"underlying scanner command (e.g. semgrep, gosec).")
}

// warnIncludes flags top-level `include:` directives so the user
// understands why an include-only pipeline (e.g. one that just
// pulls Security/SAST.gitlab-ci.yml) migrates with no executable
// stages. PushCI does not fetch GitLab template URLs.
func warnIncludes(raw map[string]interface{}, result *GitLabConvertResult) {
	v, ok := raw["include"]
	if !ok || v == nil {
		return
	}
	result.Warnings = append(result.Warnings,
		"`include:` directive present — GitLab template includes are "+
			"not resolved by PushCI. Inline the upstream commands or "+
			"replace with equivalent scanners.")
}
