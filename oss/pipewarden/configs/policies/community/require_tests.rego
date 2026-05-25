package pipewarden.require_tests

# Fail the pipeline if no test step ran.
# Heuristic: step name or `run` contains "test" (case-insensitive).

default deny := []

deny contains msg if {
	not test_step_exists
	msg := "no test step detected in pipeline (name or run must contain 'test')"
}

test_step_exists if {
	some step in input.steps
	contains(lower(step.name), "test")
}

test_step_exists if {
	some step in input.steps
	contains(lower(step.run), "test")
}
