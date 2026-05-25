# Copyright 2026 PushCI.dev. Licensed under Apache-2.0.

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "random_password" "external_id" {
  count            = var.external_id == "" ? 1 : 0
  length           = 40
  special          = false
  override_special = ""
}

locals {
  module_tags = {
    ManagedBy = "terraform"
    Module    = "pushci/aws-codepipeline-bridge"
  }

  tags = merge(local.module_tags, var.tags)

  resolved_external_id = var.external_id != "" ? var.external_id : random_password.external_id[0].result

  resolved_bucket_name = coalesce(
    var.s3_bucket_name != "" ? var.s3_bucket_name : null,
    "${var.name_prefix}-artifacts-${random_id.suffix.hex}",
  )

  partition  = data.aws_partition.current.partition
  account_id = data.aws_caller_identity.current.account_id

  # Build CodePipeline ARNs from allowed_pipelines. "*" expands to a
  # partition-wide wildcard so the caller can still list/describe pipelines.
  pipeline_resources = [
    for name in var.allowed_pipelines :
    name == "*" ?
    "arn:${local.partition}:codepipeline:*:${local.account_id}:*" :
    "arn:${local.partition}:codepipeline:*:${local.account_id}:${name}"
  ]

  role_name   = "${var.name_prefix}-bridge-role"
  policy_name = "${var.name_prefix}-bridge-policy"
}

# ---------------------------------------------------------------------------
# IAM role assumed by PushCI's runner platform via sts:AssumeRole + ExternalId.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "trust" {
  statement {
    sid     = "PushCIAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = ["arn:${local.partition}:iam::${var.pushci_aws_account_id}:root"]
    }

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [local.resolved_external_id]
    }
  }
}

resource "aws_iam_role" "pushci_bridge" {
  name               = local.role_name
  description        = "Assumed by PushCI.dev to orchestrate AWS CodePipeline runs for this account."
  assume_role_policy = data.aws_iam_policy_document.trust.json
  max_session_duration = 3600

  tags = merge(local.tags, { Name = local.role_name })
}

data "aws_iam_policy_document" "bridge" {
  # Read-only CodePipeline metadata. ListPipelines has no resource-level
  # support so it must be granted on "*".
  statement {
    sid    = "CodePipelineList"
    effect = "Allow"
    actions = [
      "codepipeline:ListPipelines",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "CodePipelineRead"
    effect = "Allow"
    actions = [
      "codepipeline:GetPipeline",
      "codepipeline:GetPipelineState",
      "codepipeline:GetPipelineExecution",
      "codepipeline:ListPipelineExecutions",
    ]
    resources = local.pipeline_resources
  }

  statement {
    sid    = "CodePipelineStart"
    effect = "Allow"
    actions = [
      "codepipeline:StartPipelineExecution",
    ]
    resources = local.pipeline_resources
  }

  dynamic "statement" {
    for_each = var.enable_s3_artifacts_bucket ? [1] : []
    content {
      sid    = "ArtifactsBucketObjects"
      effect = "Allow"
      actions = [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:PutObject",
      ]
      resources = [
        "${aws_s3_bucket.artifacts[0].arn}/*",
      ]
    }
  }

  dynamic "statement" {
    for_each = var.enable_s3_artifacts_bucket ? [1] : []
    content {
      sid    = "ArtifactsBucketList"
      effect = "Allow"
      actions = [
        "s3:ListBucket",
        "s3:GetBucketLocation",
      ]
      resources = [
        aws_s3_bucket.artifacts[0].arn,
      ]
    }
  }
}

resource "aws_iam_policy" "pushci_bridge" {
  name        = local.policy_name
  description = "Least-privilege policy allowing PushCI to list, read, and start CodePipeline executions."
  policy      = data.aws_iam_policy_document.bridge.json
  tags        = local.tags
}

resource "aws_iam_role_policy_attachment" "pushci_bridge" {
  role       = aws_iam_role.pushci_bridge.name
  policy_arn = aws_iam_policy.pushci_bridge.arn
}

# ---------------------------------------------------------------------------
# S3 artifacts bucket (optional).
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "artifacts" {
  count         = var.enable_s3_artifacts_bucket ? 1 : 0
  bucket        = local.resolved_bucket_name
  force_destroy = var.s3_bucket_force_destroy

  tags = merge(local.tags, { Name = local.resolved_bucket_name })
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  count  = var.enable_s3_artifacts_bucket ? 1 : 0
  bucket = aws_s3_bucket.artifacts[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_id != "" ? "aws:kms" : "AES256"
      kms_master_key_id = var.kms_key_id != "" ? var.kms_key_id : null
    }
    bucket_key_enabled = var.kms_key_id != ""
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  count  = var.enable_s3_artifacts_bucket ? 1 : 0
  bucket = aws_s3_bucket.artifacts[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  count  = var.enable_s3_artifacts_bucket ? 1 : 0
  bucket = aws_s3_bucket.artifacts[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  count  = var.enable_s3_artifacts_bucket ? 1 : 0
  bucket = aws_s3_bucket.artifacts[0].id

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
