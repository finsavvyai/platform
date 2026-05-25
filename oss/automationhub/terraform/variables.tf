# Terraform Variables for UPM.Plus AutomationHub

variable "environment" {
  description = "Environment name (e.g., staging, production)"
  type        = string
  default     = "staging"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"
}

variable "owner_email" {
  description = "Owner email for resource tagging"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "upm-plus-automationhub"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24"]
}

variable "enable_vpn_gateway" {
  description = "Enable VPN gateway for VPC"
  type        = bool
  default     = false
}

# EKS Configuration
variable "eks_cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "upm-plus-eks-cluster"
}

variable "eks_cluster_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "general_node_count" {
  description = "Desired count of general worker nodes"
  type        = number
  default     = 3
}

variable "general_node_min_count" {
  description = "Minimum count of general worker nodes"
  type        = number
  default     = 2
}

variable "general_node_max_count" {
  description = "Maximum count of general worker nodes"
  type        = number
  default     = 10
}

variable "general_node_instance_type" {
  description = "EC2 instance type for general worker nodes"
  type        = string
  default     = "m5.large"
}

variable "system_node_count" {
  description = "Desired count of system worker nodes"
  type        = number
  default     = 2
}

variable "system_node_min_count" {
  description = "Minimum count of system worker nodes"
  type        = number
  default     = 1
}

variable "system_node_max_count" {
  description = "Maximum count of system worker nodes"
  type        = number
  default     = 3
}

variable "system_node_instance_type" {
  description = "EC2 instance type for system worker nodes"
  type        = string
  default     = "m5.medium"
}

# RDS Configuration
variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "upmplus"
}

variable "database_username" {
  description = "Master username for RDS instance"
  type        = string
  default     = "upmplus_admin"
}

variable "database_password" {
  description = "Master password for RDS instance"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_engine" {
  description = "Database engine"
  type        = string
  default     = "postgres"
}

variable "db_engine_version" {
  description = "Database engine version"
  type        = string
  default     = "15.4"
}

variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

# ElastiCache Configuration
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_auth_token" {
  description = "Auth token for Redis"
  type        = string
  sensitive   = true
}

# S3 Configuration
variable "s3_bucket_prefix" {
  description = "Prefix for S3 bucket names"
  type        = string
  default     = "upm-plus"
}

# DNS and CDN Configuration
variable "domain_name" {
  description = "Primary domain name for the application"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token for DNS management"
  type        = string
  sensitive   = true
}

# Terraform Backend Configuration
variable "terraform_backend_bucket" {
  description = "S3 bucket for Terraform state"
  type        = string
}

variable "terraform_lock_table" {
  description = "DynamoDB table for Terraform state locking"
  type        = string
}

# Monitoring and Alerts
variable "alert_email_endpoints" {
  description = "Email addresses for alert notifications"
  type        = list(string)
  default     = []
}

variable "alert_slack_webhook" {
  description = "Slack webhook URL for alert notifications"
  type        = string
  default     = ""
  sensitive   = true
}

# Tags
variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project = "UPM.Plus AutomationHub"
    Source  = "Terraform"
  }
}

# Advanced Configuration
variable "enable_monitoring" {
  description = "Enable enhanced monitoring"
  type        = bool
  default     = true
}

variable "enable_encryption" {
  description = "Enable encryption for supported services"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable detailed logging"
  type        = bool
  default     = true
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "engineering"
}

variable "data_classification" {
  description = "Data classification level"
  type        = string
  default     = "confidential"
  validation {
    condition     = contains(["public", "internal", "confidential", "restricted"], var.data_classification)
    error_message = "Data classification must be one of: public, internal, confidential, restricted."
  }
}

# Feature Flags
variable "enable_autoscaling" {
  description = "Enable cluster autoscaling"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "enable_disaster_recovery" {
  description = "Enable disaster recovery features"
  type        = bool
  default     = false
}

# Performance Tuning
variable "enable_performance_insights" {
  description = "Enable Performance Insights for RDS"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 7
  validation {
    condition     = contains([7, 14, 30, 90], var.performance_insights_retention_period)
    error_message = "Performance Insights retention period must be one of: 7, 14, 30, 90 days."
  }
}

# Multi-AZ Configuration
variable "enable_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = true
}

variable "enable_cross_zone_load_balancing" {
  description = "Enable cross-zone load balancing"
  type        = bool
  default     = true
}

# Security Configuration
variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = true
}

variable "enable_cloudtrail" {
  description = "Enable AWS CloudTrail logging"
  type        = bool
  default     = true
}

variable "enable_guardduty" {
  description = "Enable Amazon GuardDuty"
  type        = bool
  default     = true
}

variable "enable_macie" {
  description = "Enable Amazon Macie for data discovery"
  type        = bool
  default     = false
}