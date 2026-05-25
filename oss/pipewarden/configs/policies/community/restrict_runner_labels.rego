package pipewarden.restrict_runner_labels

allowed := {"ubuntu-22.04", "ubuntu-24.04", "self-hosted-linux", "macos-14", "windows-2022"}

default deny := []

deny contains msg if {
	some step in input.steps
	step.runner != ""
	not step.runner in allowed
	msg := sprintf("step %q uses unapproved runner label %q", [step.name, step.runner])
}
