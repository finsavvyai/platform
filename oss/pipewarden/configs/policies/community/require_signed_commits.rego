package pipewarden.require_signed_commits

default deny := []

deny contains msg if {
	some commit in input.run.commits
	not commit.verified
	msg := sprintf("commit %v not GPG/SSH-signed", [commit.sha])
}
