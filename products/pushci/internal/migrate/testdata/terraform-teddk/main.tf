// Snapshot of teddk aws_pipeline/main.tf — ARNs/account IDs replaced
// with variable refs or placeholder strings. No secrets checked in.

resource "aws_codebuild_project" "compile_dockeriize_build" {
  provider      = aws.dev
  name          = "${var.codebuild_name}"
  description   = "teddk CodeBuild for compiling java code and dockerizing app"
  build_timeout = "5"
  service_role  = data.aws_iam_role.codebuild.arn

  artifacts {
    type      = "S3"
    location  = var.codebuild_artifact_s3_bucket
    path      = "artifacts/teddk"
    name      = "teddk.zip"
    packaging = "ZIP"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/amazonlinux2-x86_64-standard:3.0"
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode             = true

    environment_variable {
      name  = "AWS_DEFAULT_REGION"
      value = "eu-north-1"
    }

    environment_variable {
      name  = "AWS_ACCOUNT_ID"
      value = data.aws_caller_identity.current.account_id
    }

    environment_variable {
      name  = "IMAGE_TAG"
      value = "latest"
    }

    environment_variable {
      name  = "IMAGE_REPO_NAME"
      value = var.app_name
    }

    environment_variable {
      name  = "PROD_ROLE_ARN"
      value = var.prod_role_arn
    }
  }

  source {
    type            = "GITHUB"
    location        = "https://github.com/Shahar-Solomon-scq9102/teddk.git"
    git_clone_depth = 1
    insecure_ssl    = false
  }
  source_version = var.github_branch
}

resource "aws_codepipeline" "current" {
  provider = aws.dev
  name     = var.codepipeline_name
  role_arn = data.aws_iam_role.codepipeline.arn

  artifact_store {
    location = var.codepipeline_artifact_s3_bucket
    type     = "S3"
  }

  stage {
    name = "Source"

    action {
      name             = "S3_Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "S3"
      version          = "1"
      output_artifacts = ["s3_source_output"]

      configuration = {
        S3Bucket    = var.codebuild_artifact_s3_bucket
        S3ObjectKey = "artifacts/${var.app_name}/${var.app_name}.zip"
      }
    }
  }

  stage {
    name = "Deploy_DEV"

    action {
      name            = "Deploy"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      input_artifacts = ["s3_source_output"]
      version         = "1"

      configuration = {
        ClusterName = var.dev_cluster_name
        ServiceName = var.dev_service_name
        FileName    = "pipeline/docker/imagedefinitions.json"
      }
    }
  }

  stage {
    name = "Approve_deploy_to_prod"

    action {
      name     = "Approve"
      category = "Approval"
      owner    = "AWS"
      provider = "Manual"
      version  = "1"
    }
  }
}
