package pipewarden.no_third_party_unpinned

# Reject third-party actions pointing at @main / @master / @latest.
banned_refs := {"@main", "@master", "@latest", "@develop", "@dev"}

default deny := []

deny contains msg if {
	some step in input.steps
	some ref in banned_refs
	endswith(step.uses, ref)
	msg := sprintf("action %q uses floating ref %q — pin to SHA", [step.uses, ref])
}
