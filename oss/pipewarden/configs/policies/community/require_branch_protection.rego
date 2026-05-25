package pipewarden.require_branch_protection

# Require that the pipeline's main/release branches are marked as protected.
default deny := []

protected_branches := {"main", "master", "release", "production", "prod"}

deny contains msg if {
	input.run.branch in protected_branches
	not input.run.branch_protected
	msg := sprintf("pipeline ran on unprotected branch %q — enable branch protection", [input.run.branch])
}
