package pipewarden.max_runtime_minutes

max_minutes := 60

default deny := []

deny contains msg if {
	input.run.duration_minutes > max_minutes
	msg := sprintf("pipeline ran %d min; policy limit %d min", [input.run.duration_minutes, max_minutes])
}
