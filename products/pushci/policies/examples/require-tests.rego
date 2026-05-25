# require-tests.rego — Rego equivalent of require-tests.json
#
# Deploy this to your remote OPA server (Norlys runs OPA for Kubernetes
# admission control — you can reuse that cluster). Configure PushCI to
# POST run context to /v1/data/pushci/allow and it will use this policy
# instead of the in-process evaluator.
#
# Load into OPA:
#   curl -X PUT --data-binary @require-tests.rego \
#     http://opa.norlys.internal:8181/v1/policies/require-tests
#
# Query from PushCI:
#   POST /v1/data/pushci/allow
#   { "input": { "run": { "tests": { "ran": true } } } }

package pushci

default allow := false

# Tests must have run for the request to be allowed.
tests_ran {
    input.run.tests.ran == true
}

allow {
    tests_ran
}

denials[msg] {
    not tests_ran
    msg := "Tests are required. This run did not execute a test step — add 'test' to your .pushci.yml or run 'pushci test' locally."
}
