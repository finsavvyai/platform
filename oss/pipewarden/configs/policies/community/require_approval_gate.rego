package pipewarden.require_approval_gate

default deny := []

deny contains msg if {
	is_prod_deploy
	not input.run.approved_by
	msg := "production deploy missing manual approval — add environment protection with required reviewers"
}

is_prod_deploy if {
	some tag in {"prod", "production", "release"}
	contains(lower(input.pipeline.name), tag)
}
