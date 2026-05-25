###############################################################################
# Consumer-side Interface VPC Endpoint.
#
# Customers run THIS file (or its module-call equivalent) inside their own
# AWS account. Pass the service_name we output from the producer side.
#
#   module "sdlc_privatelink" {
#     source       = "git::https://github.com/sdlc-ai/platform.git//deployments/terraform/modules/privatelink"
#     consumer     = true
#     service_name = "com.amazonaws.vpce.us-east-1.vpce-svc-0123abcd"
#     vpc_id       = data.aws_vpc.this.id
#     subnet_ids   = data.aws_subnets.private.ids
#     security_group_ids = [aws_security_group.privatelink.id]
#   }
#
# Producer-side resources defined in main.tf are conditionally created by
# count = consumer ? 0 : 1 in v2 of this module; today producer + consumer
# live in separate root modules and the customer copy-pastes this file.
###############################################################################

variable "consumer" {
  description = "Set true on the customer side. Causes producer resources to skip."
  type        = bool
  default     = false
}

variable "service_name" {
  description = "Producer-issued AWS service name. Required when consumer = true."
  type        = string
  default     = ""
}

variable "security_group_ids" {
  description = "Customer-side SGs that allow egress to the endpoint."
  type        = list(string)
  default     = []
}

resource "aws_vpc_endpoint" "consumer" {
  count = var.consumer ? 1 : 0

  vpc_id              = var.vpc_id
  service_name        = var.service_name
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.subnet_ids
  security_group_ids  = var.security_group_ids
  private_dns_enabled = false

  tags = merge(var.tags, { Module = "privatelink", Side = "consumer" })
}
