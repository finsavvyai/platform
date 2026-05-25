# Example: with-starter-pipeline

Provisions the IAM role, artifacts bucket, AND a fully working reference
`Source(S3) -> Build(CodeBuild)` pipeline. Intended as a smoke test for
new PushCI ↔ AWS CodePipeline integrations.

## Prerequisites

- AWS credentials in the environment
- Terraform `>= 1.5`
- Your PushCI platform account ID (edit `main.tf`)

## Run it

```bash
cd deploy/terraform/aws-codepipeline-bridge/examples/with-starter-pipeline
terraform init
terraform apply
```

## Seed the source artifact

The starter pipeline polls an S3 object at `source/source.zip` — upload
any zip containing a `buildspec.yml` or a Gradle/Maven project:

```bash
zip -r source.zip .
aws s3 cp source.zip "s3://$(terraform output -raw artifacts_bucket)/source/source.zip"
```

## Trigger via PushCI

```bash
pushci aws trigger "$(terraform output -raw pipeline_name)"
```

## Clean up

```bash
terraform destroy
```

Because `s3_bucket_force_destroy = true` is set in this example,
`terraform destroy` removes the bucket even if it still has objects.
Do **not** copy that flag into production.
