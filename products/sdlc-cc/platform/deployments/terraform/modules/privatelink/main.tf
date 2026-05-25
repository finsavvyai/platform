###############################################################################
# AWS PrivateLink module — BEAT-PLAN S3.3.
#
# Creates a VPC Endpoint Service (sdlc.ai side) backed by an NLB plus the
# cross-account allow-list that lets specific customer principals create
# Interface VPC Endpoints into us. Customers run a small companion module
# (consumer.tf in this folder) on their side to materialize the endpoint.
#
# This module makes the platform reachable WITHOUT crossing the public
# internet — which is the procurement-blocking requirement for regulated
# buyers (banks, hospitals, federal).
###############################################################################

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

###############################################################################
# Inputs
###############################################################################

variable "name" {
  description = "Logical name. Used for tags + endpoint service prefix."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs the NLB lives in. One per AZ."
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID the NLB and target group live in."
  type        = string
}

variable "target_port" {
  description = "Port the NLB forwards to inside the VPC."
  type        = number
  default     = 443
}

variable "target_ip_addresses" {
  description = "IPs the NLB targets — typically the gateway service ENI IPs."
  type        = list(string)
}

variable "allowed_principals" {
  description = "Customer AWS account ARNs allowed to create endpoints."
  type        = list(string)
  default     = []
}

variable "acceptance_required" {
  description = "Require explicit acceptance per endpoint connection."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}

###############################################################################
# NLB + target group
###############################################################################

resource "aws_lb" "privatelink" {
  name               = "${var.name}-pl-nlb"
  internal           = true
  load_balancer_type = "network"
  subnets            = var.subnet_ids
  tags               = merge(var.tags, { Module = "privatelink" })

  enable_cross_zone_load_balancing = true
  enable_deletion_protection       = true
}

resource "aws_lb_target_group" "privatelink" {
  name        = "${var.name}-pl-tg"
  port        = var.target_port
  protocol    = "TCP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    protocol            = "TCP"
    interval            = 10
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }

  tags = merge(var.tags, { Module = "privatelink" })
}

resource "aws_lb_listener" "privatelink" {
  load_balancer_arn = aws_lb.privatelink.arn
  port              = var.target_port
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.privatelink.arn
  }
}

resource "aws_lb_target_group_attachment" "ips" {
  for_each         = toset(var.target_ip_addresses)
  target_group_arn = aws_lb_target_group.privatelink.arn
  target_id        = each.key
  port             = var.target_port
}

###############################################################################
# Endpoint service + permissions
###############################################################################

resource "aws_vpc_endpoint_service" "this" {
  acceptance_required        = var.acceptance_required
  network_load_balancer_arns = [aws_lb.privatelink.arn]

  tags = merge(var.tags, { Module = "privatelink", Name = "${var.name}-eps" })
}

resource "aws_vpc_endpoint_service_allowed_principal" "principals" {
  for_each                = toset(var.allowed_principals)
  vpc_endpoint_service_id = aws_vpc_endpoint_service.this.id
  principal_arn           = each.key
}
