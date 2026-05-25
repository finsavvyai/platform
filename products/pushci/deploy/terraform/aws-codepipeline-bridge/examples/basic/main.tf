# Copyright 2026 PushCI.dev. Licensed under Apache-2.0.

provider "aws" {
  region = "eu-west-1"
}

module "pushci_bridge" {
  source = "../.."

  name_prefix           = "norlys-pushci"
  pushci_aws_account_id = "123456789012" # replace with PushCI platform account

  tags = {
    Owner = "platform-team"
    Env   = "prod"
  }
}

output "role_arn" {
  value = module.pushci_bridge.role_arn
}

output "external_id" {
  value     = module.pushci_bridge.external_id
  sensitive = true
}
