# Example: basic

Minimal invocation of the `aws-codepipeline-bridge` module. Provisions
the IAM role + hardened S3 artifacts bucket and nothing else.

## Prerequisites

- AWS credentials in the environment (`aws sso login`, static keys, etc.)
- Terraform `>= 1.5`
- Your PushCI platform account ID (edit `main.tf` to replace `123456789012`)

## Run it

```bash
cd deploy/terraform/aws-codepipeline-bridge/examples/basic
terraform init
terraform apply
```

Retrieve the outputs and hand them to PushCI:

```bash
curl -X POST https://api.pushci.dev/api/aws/credentials \
  -H "Authorization: Bearer $PUSHCI_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<JSON
{
  "mode": "role",
  "roleArn": "$(terraform output -raw role_arn)",
  "externalId": "$(terraform output -raw external_id)",
  "region": "eu-west-1"
}
JSON
```
