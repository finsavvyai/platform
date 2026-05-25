package pipewarden.require_concurrency_group

# Workflows without a concurrency group risk double-deploys on rapid pushes.
default deny := []

deny contains msg if {
	input.pipeline.platform == "github"
	not input.pipeline.concurrency_group
	msg := sprintf("workflow %q missing concurrency: group — add to prevent duplicate runs", [input.pipeline.name])
}
