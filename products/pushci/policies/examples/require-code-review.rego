# require-code-review.rego — Rego equivalent of require-code-review.json
#
# Deploy this to your OPA server and wire PushCI to call it via the
# /api/policy/opa/config endpoint. Expects run context containing
# run.review.approvals populated by the PushCI webhook worker.

package pushci

default allow := false

approved {
    input.run.review.approvals >= 1
}

allow {
    approved
}

denials[msg] {
    not approved
    msg := "At least one approving review is required before this run can merge."
}
