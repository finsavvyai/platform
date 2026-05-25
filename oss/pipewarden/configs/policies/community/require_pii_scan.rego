package pipewarden.require_pii_scan

# If the repo is tagged with data/pii/hipaa, require a DLP/PII scan.
tagged_sensitive if {
	some tag in {"data", "pii", "hipaa", "hipaa-scope", "phi", "pci"}
	tag in input.pipeline.tags
}

default deny := []

deny contains msg if {
	tagged_sensitive
	not has_pii_scan
	msg := "sensitive-data repo must run PII/DLP scan before merge"
}

has_pii_scan if {
	some step in input.steps
	contains(lower(step.run), "pipewarden dlp")
}

has_pii_scan if {
	some step in input.steps
	contains(lower(step.uses), "pipewarden/dlp-action")
}
