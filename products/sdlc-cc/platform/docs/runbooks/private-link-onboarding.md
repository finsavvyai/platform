# Private Link onboarding (AWS PrivateLink / Azure Private Link / GCP PSC)

Day 27 of the production-ready roadmap. Customers in `network_mode =
'private_only'` cannot reach the gateway over the public internet —
they must traverse a Private Link endpoint they control.

## Why

Public internet AI gateways are a frequent compliance flag: SOC2,
HIPAA, GLBA reviewers want a clear network-isolation control. Private
Link gives the customer a routed path inside their own VPC; the
platform's NLB only accepts connections that present the
`X-Forwarded-Source: private-link` header injected by the customer's
Private Link policy.

## Customer prerequisites

1. AWS account with PrivateLink quota (default 50 endpoints).
2. The endpoint service id we publish per region — see the live
   list at https://sdlc.cc/private-link.
3. A VPC + subnet routable from the workloads that consume the API.

## Onboarding steps

1. **Tenant flips to private_only**. Admin -> Settings -> Network ->
   Private only. We surface the regional endpoint service ids the
   tenant can connect to.
2. **Customer creates the VPC endpoint** in AWS console / Terraform.
   ```hcl
   resource "aws_vpc_endpoint" "sdlc" {
     vpc_id            = var.vpc_id
     service_name      = "com.amazonaws.vpce.us-east-1.vpce-svc-..." # from sdlc admin UI
     vpc_endpoint_type = "Interface"
     subnet_ids        = var.subnet_ids
     security_group_ids = [aws_security_group.sdlc_ep.id]
   }
   ```
3. **Customer accepts the connection request**. We auto-approve once
   the tenant id is verified against the AWS account id we have on
   file.
4. **Customer hits the endpoint URL** instead of `api.sdlc.cc` — the
   regional NLB sees `X-Forwarded-Source: private-link` and admits.
5. **Verify**. From a workload inside the customer VPC:
   ```bash
   curl -H "Authorization: Bearer $KEY" https://vpce-...amazonaws.com/health
   ```

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| 403 forbidden | tenant in private_only but request missing the `X-Forwarded-Source` header — i.e. came over public internet | Ensure the request is going to the Private Link endpoint, not `api.sdlc.cc` |
| Endpoint rejection | account id mismatch between AWS endpoint owner and the tenant on file | Update tenant_settings.aws_account_id; we auto-approve next attempt |
| Latency spike | Customer chose a single subnet | Spread across at least 2 AZs |

## Terraform modules (provided)

- `deployments/network/aws/private-link/` — endpoint + security group +
  per-region IAM policy.
- `deployments/network/azure/private-link/` — Private Link Service +
  Network Interface.
- `deployments/network/gcp/private-service-connect/` — Service
  Attachment + Forwarding Rule.

Each emits the customer-facing connection string + the IAM principal
they need to add to their endpoint service allowlist.

## Compliance evidence

- SOC2 — control CC6.6 (network segmentation): point auditor at the
  per-region endpoint service id list + tenant-side configuration
  audit log entries.
- HIPAA — 45 CFR 164.312(e)(1) (transmission security): same evidence
  set; the BAA references this runbook.
