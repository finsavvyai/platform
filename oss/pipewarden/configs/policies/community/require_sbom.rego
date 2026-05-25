package pipewarden.require_sbom

sbom_tools := {"syft", "cyclonedx", "spdx", "trivy sbom"}

default deny := []

deny contains msg if {
	not has_sbom
	msg := "no SBOM generation detected — use syft / cyclonedx / trivy sbom"
}

has_sbom if {
	some step in input.steps
	some t in sbom_tools
	contains(lower(step.run), t)
}

has_sbom if {
	some step in input.steps
	some t in sbom_tools
	contains(lower(step.uses), t)
}
