# Feature: Trigger Management and Webhook Security
- Product: AutomationHub Core
- Workflow: Event and Webhook Triggering
- Status: Implemented
- Priority: P1

## Code References
- `src/automationhub/triggers.py` (`TriggerManager`, `WebhookTrigger`, `EventTrigger`, `ManualTrigger`)
- `src/automationhub/api.py` (trigger registration/listing)
- `tests/test_triggers.py`
- `tests/test_api.py`

## Context Package
- Token budget: 3400
- Key types: `TriggerType`, `Trigger`, `WebhookTrigger`
- Dependencies: HMAC SHA-256 signature format `sha256=<digest>`

## Approval Gates
- [ ] Design review
- [ ] Security review
- [ ] Test plan approved

## E2E Test Spec
- Create webhook trigger without endpoint/secret -> fails validation.
- Create event trigger without `event_name` -> fails validation.
- Validate webhook with correct signature and payload -> returns `True`.
- Validate webhook with invalid signature or empty payload -> returns `False`.
- Activate/deactivate/delete unknown trigger ids -> return `False` safely.
