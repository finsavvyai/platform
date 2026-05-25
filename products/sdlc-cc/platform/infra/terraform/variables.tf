variable "environment" {
  type        = string
  description = "Environment name (production, staging, development)"
  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be one of: production, staging, development."
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for resources"
  default     = "us-west-1"
}

variable "domain_name" {
  type        = string
  description = "Primary domain name for the application"
  default     = "sdlc.cc"
}

variable "account_id" {
  type        = string
  description = "AWS account ID"
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID"
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token with required permissions"
  sensitive   = true
}

variable "vault_address" {
  type        = string
  description = "HashiCorp Vault server address"
  default     = "https://vault.sdlc.cc:8200"
}

variable "vault_token" {
  type        = string
  description = "Vault token for authentication"
  sensitive   = true
}

variable "github_repository" {
  type        = string
  description = "GitHub repository URL for CI/CD integration"
  default     = "github.com/SDLC-ai/platform"
}

variable "github_token" {
  type        = string
  description = "GitHub token for repository access"
  sensitive   = true
}

variable "ssl_certificate_arn" {
  type        = string
  description = "ARN of the SSL certificate for the load balancer"
  default     = ""
}

variable "enable_monitoring" {
  type        = bool
  description = "Enable comprehensive monitoring stack"
  default     = true
}

variable "enable_logging" {
  type        = bool
  description = "Enable centralized logging"
  default     = true
}

variable "enable_backup" {
  type        = bool
  description = "Enable automated backups"
  default     = true
}

variable "enable_security_scanning" {
  type        = bool
  description = "Enable security scanning and monitoring"
  default     = true
}

variable "worker_desired_count" {
  type        = number
  description = "Desired number of worker nodes"
  default     = 3
}

variable "worker_max_count" {
  type        = number
  description = "Maximum number of worker nodes"
  default     = 6
}

variable "worker_min_count" {
  type        = number
  description = "Minimum number of worker nodes"
  default     = 3
}

variable "worker_instance_types" {
  type        = list(string)
  description = "EC2 instance types for worker nodes"
  default     = ["m6.large", "m6.xlarge", "m6.2xlarge"]
}

variable "enable_autoscaling" {
  type        = bool
  description = "Enable cluster autoscaling"
  default     = true
}

variable "enable_encryption" {
  type        = bool
  description = "Enable encryption for all resources"
  default     = true
}

variable "log_retention_days" {
  type        = number
  description = "Number of days to retain logs"
  default     = 90
}

variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain backups"
  default     = 30
}

variable "notification_email" {
  type        = string
  description = "Email for notifications and alerts"
  default     = "alerts@sdlc.cc"
}

variable "slack_webhook_url" {
  type        = string
  description = "Slack webhook URL for notifications"
  sensitive   = true
  default     = ""
}

variable "datadog_api_key" {
  type        = string
  description = "Datadog API key for monitoring"
  sensitive   = true
}

variable "datadog_app_key" {
  type        = string
  description = "Datadog application key"
  sensitive   = true
}

variable "sentry_dsn" {
  type        = string
  description = "Sentry DSN for error tracking"
  sensitive   = true
}

variable "openai_api_key" {
  type        = string
  description = "OpenAI API key"
  sensitive   = true
}

variable "anthropic_api_key" {
  type        = string
  description = "Anthropic API key"
  sensitive   = true
}

variable "database_password" {
  type        = string
  description = "Database master password"
  sensitive   = true
}

variable "redis_password" {
  type        = string
  description = "Redis password"
  sensitive   = true
}

variable "enable_multi_az" {
  type        = bool
  description = "Enable multi-AZ deployment for high availability"
  default     = true
}

variable "enable_ddos_protection" {
  type        = bool
  description = "Enable DDoS protection"
  default     = true
}

variable "enable_waf" {
  type        = bool
  description = "Enable Web Application Firewall"
  default     = true
}

variable "enable_vpc_flow_logs" {
  type        = bool
  description = "Enable VPC flow logs"
  default     = true
}

variable "enable_cloudtrail" {
  type        = bool
  description = "Enable AWS CloudTrail"
  default     = true
}

variable "enable_guardduty" {
  type        = bool
  description = "Enable AWS GuardDuty"
  default     = true
}

variable "enable_security_hub" {
  type        = bool
  description = "Enable AWS Security Hub"
  default     = true
}

variable "enable_config_rules" {
  type        = bool
  description = "Enable AWS Config rules"
  default     = true
}

variable "enable_inspector" {
  type        = bool
  description = "Enable Amazon Inspector"
  default     = true
}

variable "enable_macie" {
  type        = bool
  description = "Enable Amazon Macie for data protection"
  default     = true
}
