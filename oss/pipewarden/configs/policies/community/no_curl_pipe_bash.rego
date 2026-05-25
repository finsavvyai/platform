package pipewarden.no_curl_pipe_bash

# Block curl | bash, curl | sh, wget | bash anti-pattern.
dangerous := `(curl|wget)\s+[^\|]+\|\s*(bash|sh|zsh)`

default deny := []

deny contains msg if {
	some step in input.steps
	regex.match(dangerous, step.run)
	msg := sprintf("curl|bash anti-pattern in step %q — pin a signed binary instead", [step.name])
}
