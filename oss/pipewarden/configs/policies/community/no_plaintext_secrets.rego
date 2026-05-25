package pipewarden.no_plaintext_secrets

# Block steps with inline plaintext credentials: api_key=..., password=..., token=...
patterns := {
	`api[_-]?key\s*=\s*['"]?[A-Za-z0-9_\-]{8,}`,
	`(password|passwd|pwd)\s*=\s*['"]?[A-Za-z0-9_\-]{6,}`,
	`(secret|token)\s*=\s*['"]?[A-Za-z0-9_\-]{12,}`,
	`AKIA[0-9A-Z]{16}`,
	`ghp_[A-Za-z0-9]{30,}`,
}

default deny := []

deny contains msg if {
	some step in input.steps
	some p in patterns
	regex.match(p, step.run)
	msg := sprintf("plaintext credential pattern detected in step %q", [step.name])
}
