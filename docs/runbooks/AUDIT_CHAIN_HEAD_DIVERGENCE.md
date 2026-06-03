# AUDIT_CHAIN_HEAD_DIVERGENCE

## Trigger

The audit-chain verifier detects a mismatch between the tenant chain head
in D1 and signed audit records in R2, or the API emits repeated
`audit_emit_failed` responses while the service is otherwise healthy.

## Severity

Treat as SEV1 when production audit integrity is uncertain. Treat as SEV2
only if the divergence is isolated to staging or a known test tenant.

## Immediate Actions

1. Freeze production deploys for the affected service.
2. Capture the affected tenant ID, sequence ID, record hash, D1 head, and
   R2 object keys.
3. Stop destructive remediation. Audit records are append-only; do not
   delete or rewrite R2 objects.
4. Declare an incident using `docs/compliance/INCIDENT_RESPONSE.md`.

## Diagnosis

1. Run the audit verifier for the affected tenant and time window.
2. Compare the last accepted D1 chain head with the signed R2 records.
3. Check whether R2 write failures were captured by `peekSaveError`.
4. Check recent deploys touching audit emitters, state-store code, or
   tenant context propagation.
5. Confirm whether the divergence is a missing record, duplicate sequence,
   reordered sequence, invalid signature, or D1 head mismatch.

## Mitigation

| Scenario | Action |
|---|---|
| Code regression | Roll back per `docs/runbooks/_rollback.md`; keep the malformed window documented. |
| R2 write outage | Keep D1 chain head intact; retry durable audit writes when R2 recovers. |
| D1 head mismatch | Stop writes for affected tenant; replay signed R2 records to determine the last valid head. |
| Tenant context bug | Disable affected route or feature flag; preserve request IDs for replay. |

## Recovery Gate

Do not resolve until all are true:

- verifier passes for the affected tenant through the incident window
- new audit writes succeed for 15 continuous minutes
- malformed or missing record window is documented in the postmortem
- action items exist for any replay, customer notice, or control fix

## Evidence

Attach these to the postmortem:

- verifier command and output
- D1 chain head before and after mitigation
- R2 object keys for the incident window
- deploy IDs for any rollback
- customer/regulator notification decision
