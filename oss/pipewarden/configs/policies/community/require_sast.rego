package pipewarden.require_sast

# Require an SAST scan step. Recognises common tools by name.
sast_tools := {"semgrep", "codeql", "snyk", "sonarqube", "sonar-scanner", "bandit", "gosec", "brakeman"}

default deny := []

deny contains msg if {
	not has_sast
	msg := "no SAST step detected — expected one of: semgrep, codeql, snyk, sonarqube, bandit, gosec, brakeman"
}

has_sast if {
	some step in input.steps
	some tool in sast_tools
	contains(lower(step.run), tool)
}

has_sast if {
	some step in input.steps
	some tool in sast_tools
	contains(lower(step.uses), tool)
}
