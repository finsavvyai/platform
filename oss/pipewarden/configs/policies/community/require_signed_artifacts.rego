package pipewarden.require_signed_artifacts

# Require cosign / sigstore signing of release artifacts.
signers := {"cosign sign", "sigstore", "gpg --detach-sign", "notation sign"}

default deny := []

deny contains msg if {
	is_release
	not has_signer
	msg := "release pipeline must sign artifacts with cosign / sigstore / gpg / notation"
}

is_release if {
	some tag in {"release", "publish", "deploy"}
	contains(lower(input.pipeline.name), tag)
}

has_signer if {
	some step in input.steps
	some s in signers
	contains(lower(step.run), s)
}
