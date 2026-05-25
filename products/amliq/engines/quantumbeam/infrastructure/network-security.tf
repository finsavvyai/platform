# Network Security Configuration for QuantumBeam
# This module configures VPC, security groups, WAF, and other network security components

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# AWS WAFv2 WebACL for API protection
resource "aws_wafv2_web_acl" "quantumbeam_api" {
  name        = "${var.project_name}-api-waf"
  description = "Web ACL for QuantumBeam API protection"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rule 1: Rate limiting
  rule {
    name     = "RateLimitRule"
    priority = 1

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    action {
      block {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2: SQL Injection protection
  rule {
    name     = "SQLInjectionRule"
    priority = 2

    statement {
      sqli_match_statement {
        field_to_match {
          body {}
        }
        text_transformation {
          priority = 0
          type     = "URL_DECODE"
        }
        text_transformation {
          priority = 1
          type     = "HTML_ENTITY_DECODE"
        }
      }
    }

    action {
      block {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLInjectionRule"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3: XSS protection
  rule {
    name     = "XSSRule"
    priority = 3

    statement {
      xss_match_statement {
        field_to_match {
          body {}
        }
        text_transformation {
          priority = 0
          type     = "URL_DECODE"
        }
        text_transformation {
          priority = 1
          type     = "HTML_ENTITY_DECODE"
        }
      }
    }

    action {
      block {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "XSSRule"
      sampled_requests_enabled   = true
    }
  }

  # Rule 4: Bad bot protection
  rule {
    name     = "BadBotRule"
    priority = 4

    statement {
      and_statement {
        statement {
          byte_match_statement {
            field_to_match {
              headers {
                name = "user-agent"
              }
            }
            positional_constraint = "CONTAINS"
            search_string         = "bot"
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
        statement {
          byte_match_statement {
            field_to_match {
              headers {
                name = "user-agent"
              }
            }
            positional_constraint = "CONTAINS"
            search_string         = "crawl"
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }

    action {
      block {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "BadBotRule"
      sampled_requests_enabled   = true
    }
  }

  # Rule 5: Size restriction
  rule {
    name     = "SizeRestrictionRule"
    priority = 5

    statement {
      size_constraint_statement {
        comparison_operator = "GT"
        size                 = 8192
        field_to_match {
          body {}
        }
        text_transformation {
          priority = 0
          type     = "NONE"
        }
      }
    }

    action {
      block {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SizeRestrictionRule"
      sampled_requests_enabled   = true
    }
  }

  # Rule 6: IP reputation block list
  rule {
    name     = "IPReputationRule"
    priority = 6

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.blocked_ips.arn
      }
    }

    action {
      block {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "IPReputationRule"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-api-waf"
    sampled_requests_enabled   = true
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-api-waf"
    }
  )
}

# IP Set for blocked IPs
resource "aws_wafv2_ip_set" "blocked_ips" {
  name               = "${var.project_name}-blocked-ips"
  description        = "IP addresses to block"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = var.blocked_ip_ranges

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-blocked-ips"
    }
  )
}

# Regional Web ACL Association with API Load Balancer
resource "aws_wafv2_web_acl_association" "api_waf" {
  resource_arn = aws_lb.api.arn
  web_acl_arn  = aws_wafv2_web_acl.quantumbeam_api.arn
}

# Security Group for API Load Balancer
resource "aws_security_group" "api_lb" {
  name_prefix = "${var.project_name}-api-lb-"
  description = "Security group for API load balancer"
  vpc_id      = data.aws_vpc.main.id

  # HTTP from anywhere
  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS from anywhere
  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound to API servers
  egress {
    description = "Outbound to API servers"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-api-lb"
    }
  )
}

# Security Group for API Servers
resource "aws_security_group" "api" {
  name_prefix = "${var.project_name}-api-"
  description = "Security group for API servers"
  vpc_id      = data.aws_vpc.main.id

  # HTTP from load balancer
  ingress {
    description     = "HTTP from load balancer"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.api_lb.id]
  }

  # Inter-service communication
  ingress {
    description     = "Inter-service communication"
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    self            = true
  }

  # Database access
  egress {
    description = "PostgreSQL access"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.rds.id]
  }

  # Redis access
  egress {
    description = "Redis access"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    security_groups = [aws_security_group.redis.id]
  }

  # Quantum service access
  egress {
    description     = "Quantum service access"
    from_port       = 8001
    to_port         = 8001
    protocol        = "tcp"
    security_groups = [aws_security_group.quantum.id]
  }

  # AI/ML service access
  egress {
    description     = "AI/ML service access"
    from_port       = 8002
    to_port         = 8002
    protocol        = "tcp"
    security_groups = [aws_security_group.ai_ml.id]
  }

  # HTTPS to external services
  egress {
    description = "HTTPS to external services"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-api"
    }
  )
}

# Security Group for Quantum Service
resource "aws_security_group" "quantum" {
  name_prefix = "${var.project_name}-quantum-"
  description = "Security group for quantum service"
  vpc_id      = data.aws_vpc.main.id

  # Quantum API from API servers
  ingress {
    description     = "Quantum API from API servers"
    from_port       = 8001
    to_port         = 8001
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  # Health checks from load balancer
  ingress {
    description     = "Health checks"
    from_port       = 8001
    to_port         = 8001
    protocol        = "tcp"
    security_groups = [aws_security_group.api_lb.id]
  }

  # Database access
  egress {
    description = "PostgreSQL access"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.rds.id]
  }

  # Redis access
  egress {
    description = "Redis access"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    security_groups = [aws_security_group.redis.id]
  }

  # HTTPS to quantum services
  egress {
    description = "HTTPS to quantum services"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-quantum"
    }
  )
}

# Security Group for AI/ML Service
resource "aws_security_group" "ai_ml" {
  name_prefix = "${var.project_name}-ai-ml-"
  description = "Security group for AI/ML service"
  vpc_id      = data.aws_vpc.main.id

  # AI/ML API from API servers
  ingress {
    description     = "AI/ML API from API servers"
    from_port       = 8002
    to_port         = 8002
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  # Health checks from load balancer
  ingress {
    description     = "Health checks"
    from_port       = 8002
    to_port         = 8002
    protocol        = "tcp"
    security_groups = [aws_security_group.api_lb.id]
  }

  # Redis access
  egress {
    description = "Redis access"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    security_groups = [aws_security_group.redis.id]
  }

  # HTTPS to AI/ML services
  egress {
    description = "HTTPS to AI/ML services"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-ai-ml"
    }
  )
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-rds-"
  description = "Security group for RDS database"
  vpc_id      = data.aws_vpc.main.id

  # PostgreSQL from API servers
  ingress {
    description     = "PostgreSQL from API servers"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  # PostgreSQL from quantum service
  ingress {
    description     = "PostgreSQL from quantum service"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.quantum.id]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-rds"
    }
  )
}

# Security Group for Redis
resource "aws_security_group" "redis" {
  name_prefix = "${var.project_name}-redis-"
  description = "Security group for Redis"
  vpc_id      = data.aws_vpc.main.id

  # Redis from API servers
  ingress {
    description     = "Redis from API servers"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  # Redis from quantum service
  ingress {
    description     = "Redis from quantum service"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.quantum.id]
  }

  # Redis from AI/ML service
  ingress {
    description     = "Redis from AI/ML service"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ai_ml.id]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-redis"
    }
  )
}

# Network ACLs for additional security
resource "aws_network_acl" "private" {
  vpc_id     = data.aws_vpc.main.id
  subnet_ids = data.aws_subnets.private.ids

  # Allow inbound HTTP/HTTPS
  ingress {
    rule_no    = 100
    protocol   = "tcp"
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 80
    to_port    = 80
  }

  ingress {
    rule_no    = 110
    protocol   = "tcp"
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 443
    to_port    = 443
  }

  # Allow inbound ephemeral ports
  ingress {
    rule_no    = 120
    protocol   = "tcp"
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
  }

  # Allow all outbound traffic
  egress {
    rule_no    = 100
    protocol   = "-1"
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-private-nacl"
    }
  )
}

# Data sources
data "aws_vpc" "main" {
  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-vpc"]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  filter {
    name   = "tag:Type"
    values = ["private"]
  }
}

# Variables
variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "blocked_ip_ranges" {
  description = "List of IP ranges to block"
  type        = list(string)
  default     = []
}

# Outputs
output "waf_web_acl_arn" {
  description = "ARN of the WAF WebACL"
  value       = aws_wafv2_web_acl.quantumbeam_api.arn
}

output "api_lb_security_group_id" {
  description = "ID of the API load balancer security group"
  value       = aws_security_group.api_lb.id
}

output "api_security_group_id" {
  description = "ID of the API security group"
  value       = aws_security_group.api.id
}