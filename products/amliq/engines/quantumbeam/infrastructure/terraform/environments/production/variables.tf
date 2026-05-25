# QuantumBeam Production Infrastructure Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "quantumbeam"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "kubernetes_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.28"
}

variable "domain" {
  description = "Primary domain name"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "datadog_api_key" {
  description = "Datadog API key"
  type        = string
  sensitive   = true
}

variable "datadog_app_key" {
  description = "Datadog app key"
  type        = string
  sensitive   = true
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
}

variable "database_name" {
  description = "RDS database name"
  type        = string
  default     = "quantumbeam"
}

variable "database_username" {
  description = "RDS database username"
  type        = string
  default     = "quantumbeam_user"
}

variable "monthly_budget_limit" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 10000
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}