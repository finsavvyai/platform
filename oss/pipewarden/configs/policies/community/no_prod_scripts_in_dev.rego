package pipewarden.no_prod_scripts_in_dev

default deny := []

deny contains msg if {
	is_non_prod_workflow
	some step in input.steps
	contains(lower(step.run), "deploy-prod")
	msg := sprintf("non-prod workflow %q invokes deploy-prod script — move to prod workflow only", [input.pipeline.name])
}

is_non_prod_workflow if {
	name := lower(input.pipeline.name)
	not contains(name, "prod")
	not contains(name, "release")
}
