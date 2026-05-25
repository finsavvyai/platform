package pipewarden.require_tls_env

# Every env var whose name ends in _URL must be https:// (except localhost/loopback).
default deny := []

deny contains msg if {
	some k, v in input.run.env
	endswith(lower(k), "_url")
	not startswith(v, "https://")
	not startswith(v, "http://localhost")
	not startswith(v, "http://127.0.0.1")
	msg := sprintf("env %q uses non-TLS URL: %q", [k, v])
}
