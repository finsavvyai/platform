package pipewarden.require_audit_log

default deny := []

deny contains msg if {
	not has_audit
	msg := "pipeline must emit an audit event (configure pipewarden audit webhook or use audit-log action)"
}

has_audit if {
	some step in input.steps
	contains(lower(step.run), "pipewarden audit")
}

has_audit if {
	input.run.audit_event_id
}
