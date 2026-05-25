# `aws-codepipeline-bridge` — Terraform module

Provisions the AWS-side resources needed for **PushCI.dev** to orchestrate
an existing AWS CodePipeline account: a least-privilege IAM role assumed
via `sts:AssumeRole` + `ExternalId`, an (optional) hardened S3 artifacts
bucket, and an (optional) starter `Source -> Build` pipeline you can use
to verify the wiring end-to-end.

- **What is PushCI?** AI-native CI/CD platform that orchestrates your
  existing infrastructure. See [pushci.dev](https://pushci.dev).
- **What is the bridge?** A thin layer that lets PushCI's API list,
  inspect, and trigger pipelines in *your* AWS account without long-lived
  access keys or wildcard IAM permissions.
- **Why a module?** So an enterprise customer (e.g. a DK energy/telco
  operator running on AWS ControlTower) can `terraform apply` once and
  get a reviewable, auditable, reversible setup.

License: Apache-2.0.

## What it creates

| Resource                        | Purpose                                                            |
|---------------------------------|--------------------------------------------------------------------|
| `aws_iam_role.pushci_bridge`    | Role PushCI assumes; trust = `pushci_aws_account_id` + ExternalId  |
| `aws_iam_policy.pushci_bridge`  | Least-privilege CodePipeline + S3 artifact scope                   |
| `aws_s3_bucket.artifacts`       | (opt) Versioned, encrypted, private bucket for CodePipeline        |
| `aws_codepipeline.starter`      | (opt) Minimal reference `Source(S3) -> Build(CodeBuild)` pipeline  |
| `aws_codebuild_project.starter` | (opt) CodeBuild project invoked by the starter pipeline            |
| Supporting IAM roles            | (opt) Service roles for the starter pipeline and build project    |

Every resource is tagged with the module-default tags
(`ManagedBy = "terraform"`, `Module = "pushci/aws-codepipeline-bridge"`)
merged with whatever you pass via `var.tags`.

## Requirements

| Name       | Version  |
|------------|----------|
| terraform  | `>= 1.5` |
| aws        | `>= 5.0` |
| random     | `>= 3.5` |

## Usage

```hcl
module "pushci_bridge" {
  source  = "github.com/finsavvyai/pushci//deploy/terraform/aws-codepipeline-bridge"

  name_prefix           = "acme-pushci"
  pushci_aws_account_id = "123456789012" # platform account ID, from the PushCI dashboard

  tags = {
    Owner = "platform-team"
    Env   = "prod"
  }
}

output "pushci_role_arn" {
  value = module.pushci_bridge.role_arn
}

output "pushci_external_id" {
  value     = module.pushci_bridge.external_id
  sensitive = true
}
```

After `terraform apply`, paste the outputs into the PushCI dashboard or
POST them to `/api/aws/credentials` (see
[`outputs.pushci_configuration_snippet`](./outputs.tf)).

See [`examples/basic`](./examples/basic) for the smallest possible setup,
or [`examples/with-starter-pipeline`](./examples/with-starter-pipeline)
for a working end-to-end reference.

## Variables

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `name_prefix` | `string` | `"pushci"` | Lowercase prefix (`^[a-z0-9-]+$`, ≤32 chars) applied to every resource name. |
| `pushci_aws_account_id` | `string` | *(required)* | 12-digit AWS account ID of PushCI's runner platform. Fetch from the PushCI dashboard. |
| `external_id` | `string` | `""` | `sts:ExternalId` secret. Leave empty to generate a 40-char random value. |
| `region` | `string` | `null` | AWS region. `null` inherits the provider default. |
| `enable_s3_artifacts_bucket` | `bool` | `true` | Provision the hardened S3 bucket. |
| `s3_bucket_name` | `string` | `""` | Override bucket name. Empty → `<name_prefix>-artifacts-<suffix>`. |
| `s3_bucket_force_destroy` | `bool` | `false` | Allow `terraform destroy` to wipe the bucket. |
| `kms_key_id` | `string` | `""` | KMS key ARN/ID for SSE-KMS. Empty → SSE-S3 (AES256). |
| `create_starter_pipeline` | `bool` | `false` | Provision the reference CodePipeline. |
| `codebuild_image` | `string` | `"aws/codebuild/standard:7.0"` | Image for the starter CodeBuild project. |
| `tags` | `map(string)` | `{}` | Extra tags merged onto every resource. |
| `allowed_pipelines` | `list(string)` | `["*"]` | Pipeline names the bridge role can read/start. Tighten in prod. |

See [`variables.tf`](./variables.tf) for the authoritative definitions
and their validation rules.

## Outputs

| Name | Sensitive | Description |
|------|-----------|-------------|
| `role_arn` | no | ARN of the role PushCI assumes. Paste into the dashboard. |
| `role_name` | no | Bare name of the role. |
| `external_id` | **yes** | Resolved `sts:ExternalId`. Pass alongside `role_arn` to PushCI. |
| `artifacts_bucket_name` | no | Bucket name (`null` if disabled). |
| `artifacts_bucket_arn` | no | Bucket ARN (`null` if disabled). |
| `starter_pipeline_name` | no | Starter pipeline name (`null` if disabled). |
| `pushci_configuration_snippet` | **yes** | JSON body ready to POST to `/api/aws/credentials`. |

Retrieve outputs with:

```bash
terraform output role_arn
terraform output -raw external_id    # sensitive — -raw required
terraform output -raw pushci_configuration_snippet
```

## Security notes

- **No long-lived keys.** The bridge uses `sts:AssumeRole` with an
  ExternalId condition. PushCI never sees an IAM user access key.
- **Trust scoped to PushCI's account.** The role's trust policy only
  accepts `arn:aws:iam::<pushci_aws_account_id>:root`. Changing the
  platform account ID is a deliberate operator action.
- **ExternalId required.** Defends against the
  [confused-deputy](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html)
  attack class. PushCI has to present the exact value to assume the role.
- **Least-privilege policy.** Only the six `codepipeline:*` actions
  needed by the bridge plus bucket-scoped `s3:GetObject/PutObject/List`.
  Never `Action = "*"`, never `Resource = "*"` on write operations
  (apart from `ListPipelines`, which AWS requires on `*`).
- **Pipeline scoping.** Set `allowed_pipelines` to restrict which
  CodePipeline ARNs the role may touch. Default `["*"]` is convenient
  for dev and explicitly flagged in the variable description.
- **Bucket hardening.** Versioning on, public access blocked,
  noncurrent versions expired after 30 days, optional SSE-KMS.
- **KMS recommended.** Set `kms_key_id` for customer-managed encryption
  if you route artifacts through sensitive stages. The module picks the
  right `sse_algorithm` automatically.
- **VPC endpoint (optional).** For regulated environments consider
  adding a `com.amazonaws.<region>.codepipeline` interface endpoint so
  traffic from PushCI's runner (if you use a managed runner inside your
  VPC) never leaves your private subnet. Not provisioned by this
  module — keep the scope minimal and wire it up separately.
- **Auditability.** Everything is tagged `Module = pushci/aws-codepipeline-bridge`
  so CloudTrail, Config, and Cost Explorer can filter on the module.

## Revoking access

To rotate or revoke:

1. `terraform apply -replace=random_password.external_id[0]` — rotates
   the ExternalId. Re-paste the new value into the PushCI dashboard.
2. `terraform destroy -target=aws_iam_role.pushci_bridge` — removes the
   role. PushCI will get `AccessDenied` on the next API call.
3. Re-run `terraform apply` to restore once the incident is resolved.

## License

Apache License, Version 2.0. See the `LICENSE` file at the root of the
[pushci](https://github.com/finsavvyai/pushci) repository.
