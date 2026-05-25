package pipewarden.require_dependency_scan

tools := {"npm audit", "pip-audit", "cargo audit", "go list -m", "dependabot", "trivy", "snyk test", "osv-scanner"}

default deny := []

deny contains msg if {
	not has_scan
	msg := "no dependency scan detected — require npm audit / pip-audit / cargo audit / trivy / snyk test / osv-scanner"
}

has_scan if {
	some step in input.steps
	some tool in tools
	contains(lower(step.run), tool)
}

has_scan if {
	some step in input.steps
	some tool in tools
	contains(lower(step.uses), tool)
}
