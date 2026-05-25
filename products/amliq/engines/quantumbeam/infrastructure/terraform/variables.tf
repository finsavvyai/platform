# Terraform variables for QuantumBeam infrastructure

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "quantumbeam"
}

variable "environment" {
  description = "Environment name (e.g., staging, production)"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "owner" {
  description = "Owner of the infrastructure"
  type        = string
  default     = "devops@quantumbeam.io"
}

variable "kubernetes_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "route53_hosted_zone_id" {
  description = "Route53 hosted zone ID for DNS management"
  type        = string
  sensitive   = true
}

variable "redis_auth_token" {
  description = "Authentication token for Redis"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default = {
    Environment = "production"
    Project     = "QuantumBeam"
    ManagedBy   = "Terraform"
  }
}

variable "enable_monitoring" {
  description = "Enable enhanced monitoring and logging"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable automated backup solutions"
  type        = bool
  default     = true
}

variable "enable_security_scanning" {
  description = "Enable security scanning and compliance checks"
  type        = bool
  default     = true
}