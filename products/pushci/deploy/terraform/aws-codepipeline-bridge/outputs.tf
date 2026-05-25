# Copyright 2026 PushCI.dev. Licensed under Apache-2.0.

output "role_arn" {
  description = "ARN of the IAM role PushCI's runner platform assumes. Paste this into the PushCI dashboard or POST it to /api/aws/credentials."
  value       = aws_iam_role.pushci_bridge.arn
}

output "role_name" {
  description = "Name of the IAM role created for the bridge."
  value       = aws_iam_role.pushci_bridge.name
}

output "external_id" {
  description = "Resolved sts:ExternalId value. Pass this alongside the role ARN when registering AWS credentials with PushCI."
  value       = local.resolved_external_id
  sensitive   = true
}

output "artifacts_bucket_name" {
  description = "Name of the artifacts S3 bucket. Null when enable_s3_artifacts_bucket is false."
  value       = var.enable_s3_artifacts_bucket ? aws_s3_bucket.artifacts[0].bucket : null
}

output "artifacts_bucket_arn" {
  description = "ARN of the artifacts S3 bucket. Null when enable_s3_artifacts_bucket is false."
  value       = var.enable_s3_artifacts_bucket ? aws_s3_bucket.artifacts[0].arn : null
}

output "starter_pipeline_name" {
  description = "Name of the starter CodePipeline, if create_starter_pipeline was enabled."
  value       = var.create_starter_pipeline ? aws_codepipeline.starter[0].name : null
}

output "pushci_configuration_snippet" {
  description = "JSON body to POST to PushCI's /api/aws/credentials endpoint. The external_id is marked sensitive so terraform output may require -json or explicit unmasking."
  sensitive   = true
  value = <<-EOT
    {
      "mode": "role",
      "roleArn": "${aws_iam_role.pushci_bridge.arn}",
      "externalId": "${local.resolved_external_id}",
      "region": "${coalesce(var.region, "us-east-1")}"
    }
  EOT
}
