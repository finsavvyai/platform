package pipewarden.block_force_push_main

protected := {"main", "master", "release", "production"}

default deny := []

deny contains msg if {
	input.run.forced
	input.run.branch in protected
	msg := sprintf("force-push detected on protected branch %q", [input.run.branch])
}
