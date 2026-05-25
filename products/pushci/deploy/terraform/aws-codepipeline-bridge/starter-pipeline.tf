# Copyright 2026 PushCI.dev. Licensed under Apache-2.0.

# ---------------------------------------------------------------------------
# OPTIONAL starter pipeline.
#
# Every resource in this file is gated on var.create_starter_pipeline.
# The result is a minimal but working Source(S3) -> Build(CodeBuild) pipeline
# so that a PushCI operator can immediately verify end-to-end wiring from
# the CLI or dashboard. DO NOT use this for production workloads.
# ---------------------------------------------------------------------------

locals {
  starter_count               = var.create_starter_pipeline ? 1 : 0
  starter_pipeline_name       = "${var.name_prefix}-starter-pipeline"
  starter_codebuild_name      = "${var.name_prefix}-starter-build"
  starter_codepipeline_role   = "${var.name_prefix}-starter-pipeline-role"
  starter_codebuild_role_name = "${var.name_prefix}-starter-build-role"
}

# ------- CodePipeline service role -----------------------------------------

data "aws_iam_policy_document" "starter_codepipeline_trust" {
  count = local.starter_count

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codepipeline.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codepipeline" {
  count              = local.starter_count
  name               = local.starter_codepipeline_role
  assume_role_policy = data.aws_iam_policy_document.starter_codepipeline_trust[0].json
  tags               = merge(local.tags, { Name = local.starter_codepipeline_role })
}

data "aws_iam_policy_document" "starter_codepipeline" {
  count = local.starter_count

  statement {
    sid    = "ArtifactsBucket"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
      "s3:ListBucket",
      "s3:GetBucketVersioning",
    ]
    resources = [
      aws_s3_bucket.artifacts[0].arn,
      "${aws_s3_bucket.artifacts[0].arn}/*",
    ]
  }

  statement {
    sid    = "CodeBuildInvoke"
    effect = "Allow"
    actions = [
      "codebuild:BatchGetBuilds",
      "codebuild:StartBuild",
    ]
    resources = [aws_codebuild_project.starter[0].arn]
  }
}

resource "aws_iam_role_policy" "codepipeline" {
  count  = local.starter_count
  name   = "${local.starter_codepipeline_role}-inline"
  role   = aws_iam_role.codepipeline[0].id
  policy = data.aws_iam_policy_document.starter_codepipeline[0].json
}

# ------- CodeBuild service role --------------------------------------------

data "aws_iam_policy_document" "starter_codebuild_trust" {
  count = local.starter_count

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild" {
  count              = local.starter_count
  name               = local.starter_codebuild_role_name
  assume_role_policy = data.aws_iam_policy_document.starter_codebuild_trust[0].json
  tags               = merge(local.tags, { Name = local.starter_codebuild_role_name })
}

data "aws_iam_policy_document" "starter_codebuild" {
  count = local.starter_count

  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "arn:${local.partition}:logs:*:${local.account_id}:log-group:/aws/codebuild/${local.starter_codebuild_name}",
      "arn:${local.partition}:logs:*:${local.account_id}:log-group:/aws/codebuild/${local.starter_codebuild_name}:*",
    ]
  }

  statement {
    sid    = "ArtifactsBucket"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.artifacts[0].arn,
      "${aws_s3_bucket.artifacts[0].arn}/*",
    ]
  }

  statement {
    sid    = "CloudWatchMetrics"
    effect = "Allow"
    actions = [
      "cloudwatch:PutMetricData",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "codebuild" {
  count  = local.starter_count
  name   = "${local.starter_codebuild_role_name}-inline"
  role   = aws_iam_role.codebuild[0].id
  policy = data.aws_iam_policy_document.starter_codebuild[0].json
}

# ------- CodeBuild project -------------------------------------------------

resource "aws_codebuild_project" "starter" {
  count         = local.starter_count
  name          = local.starter_codebuild_name
  description   = "PushCI starter build project. Attempts gradle, maven, then prints a no-op message."
  service_role  = aws_iam_role.codebuild[0].arn
  build_timeout = 30

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = var.codebuild_image
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = <<-EOT
      version: 0.2
      phases:
        build:
          commands:
            - echo "PushCI starter build running"
            - ./gradlew build || mvn -B package || echo "no build tool detected"
      artifacts:
        files:
          - '**/*'
    EOT
  }

  tags = merge(local.tags, { Name = local.starter_codebuild_name })
}

# ------- CodePipeline ------------------------------------------------------

resource "aws_codepipeline" "starter" {
  count    = local.starter_count
  name     = local.starter_pipeline_name
  role_arn = aws_iam_role.codepipeline[0].arn

  artifact_store {
    location = aws_s3_bucket.artifacts[0].bucket
    type     = "S3"

    dynamic "encryption_key" {
      for_each = var.kms_key_id != "" ? [var.kms_key_id] : []
      content {
        id   = encryption_key.value
        type = "KMS"
      }
    }
  }

  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "S3"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        S3Bucket             = aws_s3_bucket.artifacts[0].bucket
        S3ObjectKey          = "source/source.zip"
        PollForSourceChanges = "false"
      }
    }
  }

  stage {
    name = "Build"

    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]

      configuration = {
        ProjectName = aws_codebuild_project.starter[0].name
      }
    }
  }

  tags = merge(local.tags, { Name = local.starter_pipeline_name })
}
