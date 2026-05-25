package pipewarden.pin_action_shas

# GitHub Actions `uses:` must pin to a 40-char commit SHA, not a tag or branch.
sha_pattern := `^[a-z0-9_.\-]+/[a-z0-9_.\-]+@[a-f0-9]{40}$`

default deny := []

deny contains msg if {
	some step in input.steps
	step.uses != ""
	not regex.match(sha_pattern, step.uses)
	msg := sprintf("action %q not pinned to SHA — use @<40-char-sha>", [step.uses])
}
