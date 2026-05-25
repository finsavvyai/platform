# Variables for SDLC.ai Production Deployment

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with required permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Primary domain name for the application"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid domain format."
  }
}

variable "aws_region" {
  description = "AWS region for backup services"
  type        = string
  default     = "us-west-2"

  validation {
    condition     = contains(["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"], var.aws_region)
    error_message = "AWS region must be one of the supported regions for PCI compliance."
  }
}

variable "stripe_secret_key" {
  description = "Stripe secret key for payment processing"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "Master encryption key for data protection"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.encryption_key) >= 32
    error_message = "Encryption key must be at least 32 characters long."
  }
}

variable "github_owner" {
  description = "GitHub repository owner"
  type        = string
  default     = "sdlc-ai"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "sdlc-platform"
}

variable "database_config" {
  description = "Database configuration settings"
  type = object({
    max_connections = number
    timeout_seconds = number
  })
  default = {
    max_connections = 100
    timeout_seconds = 30
  }

  validation {
    condition     = var.database_config.max_connections > 0 && var.database_config.max_connections <= 1000
    error_message = "Max connections must be between 1 and 1000."
  }

  validation {
    condition     = var.database_config.timeout_seconds >= 1 && var.database_config.timeout_seconds <= 300
    error_message = "Timeout must be between 1 and 300 seconds."
  }
}

variable "redis_config" {
  description = "Redis configuration settings"
  type = object({
    max_memory = string
    ttl_seconds = number
  })
  default = {
    max_memory = "2gb"
    ttl_seconds = 3600
  }
}

variable "cdn_config" {
  description = "CDN configuration settings"
  type = object({
    cache_ttl = number
    compression = bool
  })
  default = {
    cache_ttl   = 86400
    compression = true
  }

  validation {
    condition     = var.cdn_config.cache_ttl >= 0 && var.cdn_config.cache_ttl <= 31536000
    error_message = "Cache TTL must be between 0 and 31536000 seconds (1 year)."
  }
}

variable "security_config" {
  description = "Security configuration settings"
  type = object({
    enable_waf          = bool
    enable_bot_fight    = bool
    rate_limit_requests = number
    rate_limit_window   = number
  })
  default = {
    enable_waf          = true
    enable_bot_fight    = true
    rate_limit_requests = 1000
    rate_limit_window   = 60
  }

  validation {
    condition     = var.security_config.rate_limit_requests > 0
    error_message = "Rate limit requests must be greater than 0."
  }

  validation {
    condition     = var.security_config.rate_limit_window >= 10 && var.security_config.rate_limit_window <= 3600
    error_message = "Rate limit window must be between 10 and 3600 seconds."
  }
}

variable "monitoring_config" {
  description = "Monitoring and alerting configuration"
  type = object({
    enable_real_user_monitoring = bool
    enable_error_tracking       = bool
    enable_performance_monitoring = bool
  })
  default = {
    enable_real_user_monitoring    = true
    enable_error_tracking          = true
    enable_performance_monitoring  = true
  }
}

variable "backup_config" {
  description = "Backup configuration"
  type = object({
    retention_days = number
    backup_frequency = string
    cross_region = bool
  })
  default = {
    retention_days    = 90
    backup_frequency  = "daily"
    cross_region      = true
  }

  validation {
    condition     = contains(["hourly", "daily", "weekly"], var.backup_config.backup_frequency)
    error_message = "Backup frequency must be one of: hourly, daily, weekly."
  }

  validation {
    condition     = var.backup_config.retention_days >= 1 && var.backup_config.retention_days <= 365
    error_message = "Retention days must be between 1 and 365."
  }
}

variable "pci_compliance" {
  description = "PCI DSS compliance configuration"
  type = object({
    level = string
    scan_frequency = string
    enable_audit_logging = bool
  })
  default = {
    level = "1"
    scan_frequency = "quarterly"
    enable_audit_logging = true
  }

  validation {
    condition     = contains(["1", "2", "3", "4"], var.pci_compliance.level)
    error_message = "PCI level must be one of: 1, 2, 3, 4."
  }

  validation {
    condition     = contains(["monthly", "quarterly", "annually"], var.pci_compliance.scan_frequency)
    error_message = "Scan frequency must be one of: monthly, quarterly, annually."
  }
}

variable "feature_flags" {
  description = "Feature flags for the application"
  type = object({
    enable_ai_features      = bool
    enable_real_time       = bool
    enable_analytics       = bool
    enable_multi_tenant    = bool
    enable_api_v2          = bool
  })
  default = {
    enable_ai_features      = true
    enable_real_time       = true
    enable_analytics       = true
    enable_multi_tenant    = true
    enable_api_v2          = true
  }
}

variable "alerting_config" {
  description = "Alerting configuration"
  type = object({
    email_recipients = list(string)
    slack_webhook_url = string
    pagerduty_key = string
    enable_slack = bool
    enable_pagerduty = bool
  })
  default = {
    email_recipients = []
    slack_webhook_url = ""
    pagerduty_key = ""
    enable_slack = false
    enable_pagerduty = false
  }

  validation {
    condition     = length(var.alerting_config.email_recipients) <= 10
    error_message = "Maximum 10 email recipients allowed."
  }
}

variable "scaling_config" {
  description = "Auto-scaling configuration"
  type = object({
    min_instances = number
    max_instances = number
    target_cpu_utilization = number
    target_memory_utilization = number
  })
  default = {
    min_instances = 2
    max_instances = 100
    target_cpu_utilization = 70
    target_memory_utilization = 80
  }

  validation {
    condition     = var.scaling_config.min_instances >= 1 && var.scaling_config.min_instances <= var.scaling_config.max_instances
    error_message = "Min instances must be >= 1 and <= max instances."
  }

  validation {
    condition     = var.scaling_config.target_cpu_utilization >= 50 && var.scaling_config.target_cpu_utilization <= 90
    error_message = "Target CPU utilization must be between 50 and 90 percent."
  }
}

variable "log_retention" {
  description = "Log retention settings"
  type = object({
    access_logs_days = number
    error_logs_days = number
    audit_logs_days = number
  })
  default = {
    access_logs_days = 30
    error_logs_days = 90
    audit_logs_days = 2555 # 7 years for PCI compliance
  }

  validation {
    condition     = var.log_retention.audit_logs_days >= 2555
    error_message = "Audit logs must be retained for at least 2555 days (7 years) for PCI compliance."
  }
}
