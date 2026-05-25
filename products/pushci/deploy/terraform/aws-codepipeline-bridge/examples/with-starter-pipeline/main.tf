# Copyright 2026 PushCI.dev. Licensed under Apache-2.0.

provider "aws" {
  region = "eu-west-1"
}

module "pushci_bridge" {
  source = "../.."

  name_prefix             = "norlys-pushci-demo"
  pushci_aws_account_id   = "123456789012" # replace with PushCI platform account
  create_starter_pipeline = true
  s3_bucket_force_destroy = true # demo-only: allows `terraform destroy` to clean up

  allowed_pipelines = [
    "norlys-pushci-demo-starter-pipeline",
  ]

  tags = {
    Owner = "platform-team"
    Env   = "demo"
  }
}

output "role_arn" {
  value = module.pushci_bridge.role_arn
}

output "external_id" {
  value     = module.pushci_bridge.external_id
  sensitive = true
}

output "pipeline_name" {
  value = module.pushci_bridge.starter_pipeline_name
}

output "artifacts_bucket" {
  value = module.pushci_bridge.artifacts_bucket_name
}
