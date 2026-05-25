package pipewarden.require_secret_scan

scanners := {"gitleaks", "trufflehog", "detect-secrets", "pipewarden dlp"}

default deny := []

deny contains msg if {
	not has_scanner
	msg := "no secret-scan step detected — expected gitleaks, trufflehog, detect-secrets, or pipewarden dlp"
}

has_scanner if {
	some step in input.steps
	some tool in scanners
	contains(lower(step.run), tool)
}

has_scanner if {
	some step in input.steps
	some tool in scanners
	contains(lower(step.uses), tool)
}
