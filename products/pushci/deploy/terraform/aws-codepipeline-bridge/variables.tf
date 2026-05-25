# Copyright 2026 PushCI.dev. Licensed under Apache-2.0.

variable "name_prefix" {
  description = "Prefix prepended to every resource name created by this module. Must be lowercase letters, digits, and hyphens only."
  type        = string
  default     = "pushci"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.name_prefix)) && length(var.name_prefix) <= 32
    error_message = "name_prefix must match ^[a-z0-9-]+$ and be at most 32 characters long."
  }
}

variable "pushci_aws_account_id" {
  description = "The AWS account ID PushCI's runner platform will assume-role FROM. This is the trusted third-party account that the IAM trust policy allows via sts:AssumeRole with an External ID. Ask PushCI support for the current platform account ID or read it from your dashboard's AWS integration page."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.pushci_aws_account_id))
    error_message = "pushci_aws_account_id must be exactly 12 digits."
  }
}

variable "external_id" {
  description = "Shared secret used as the sts:ExternalId condition on the AssumeRole trust policy. Leave empty to let this module generate a 40-character random value. You MUST supply the same value when registering credentials with PushCI."
  type        = string
  default     = ""
  sensitive   = true

  validation {
    condition     = var.external_id == "" || length(var.external_id) >= 8
    error_message = "external_id, if provided, must be at least 8 characters."
  }
}

variable "region" {
  description = "AWS region the resources should live in. Leave null to inherit from the provider configuration."
  type        = string
  default     = null
}

variable "enable_s3_artifacts_bucket" {
  description = "Whether to create an S3 bucket to hold CodePipeline artifacts. Set to false if you already have a bucket and only want IAM wired up."
  type        = bool
  default     = true
}

variable "s3_bucket_name" {
  description = "Explicit name for the artifacts bucket. If empty, the module generates '<name_prefix>-artifacts-<random_suffix>'."
  type        = string
  default     = ""

  validation {
    condition     = var.s3_bucket_name == "" || can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.s3_bucket_name))
    error_message = "s3_bucket_name must be a valid S3 bucket name (lowercase letters, digits, dots, hyphens; 3-63 characters; start and end alphanumeric)."
  }
}

variable "s3_bucket_force_destroy" {
  description = "If true, terraform destroy will delete the bucket even if it contains objects. Use with care in production."
  type        = bool
  default     = false
}

variable "kms_key_id" {
  description = "KMS key ARN or ID used for SSE-KMS on the artifacts bucket. If empty, SSE-S3 (AES256) is used instead. Using KMS is recommended for enterprise deployments."
  type        = string
  default     = ""
}

variable "create_starter_pipeline" {
  description = "If true, provisions a minimal example CodePipeline (Source from S3 + Build via CodeBuild) alongside the IAM role. Intended as a working reference; disable for production."
  type        = bool
  default     = false
}

variable "codebuild_image" {
  description = "Container image used by the starter CodeBuild project. Ignored when create_starter_pipeline is false."
  type        = string
  default     = "aws/codebuild/standard:7.0"
}

variable "tags" {
  description = "Additional tags merged onto every resource. Module-default tags ({ ManagedBy = \"terraform\", Module = \"pushci/aws-codepipeline-bridge\" }) are always applied."
  type        = map(string)
  default     = {}
}

variable "allowed_pipelines" {
  description = "List of CodePipeline names the bridge role is allowed to read and start. Defaults to [\"*\"] meaning every pipeline in the account; tighten this in production."
  type        = list(string)
  default     = ["*"]

  validation {
    condition     = length(var.allowed_pipelines) > 0
    error_message = "allowed_pipelines must contain at least one entry."
  }
}
