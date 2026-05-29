variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "database_subnet_ids" {
  type        = list(string)
  description = "List of database subnet IDs"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for Redis"
}

variable "allowed_security_groups" {
  type        = list(string)
  description = "List of security groups allowed to access the database"
}

variable "bastion_security_group_id" {
  type        = string
  description = "Security group ID for bastion host"
}

variable "database_name" {
  type        = string
  description = "Name of the database"
  default     = "sdlc_platform"
}

variable "database_username" {
  type        = string
  description = "Master username for the database"
  default     = "sdlc_admin"
}

variable "instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.r6g.large"
}

variable "replica_instance_class" {
  type        = string
  description = "RDS read replica instance class"
  default     = "db.r6g.large"
}

variable "allocated_storage" {
  type        = number
  description = "Initial allocated storage in GB"
  default     = 100
}

variable "max_allocated_storage" {
  type        = number
  description = "Maximum allocated storage in GB"
  default     = 1000
}

variable "backup_retention_period" {
  type        = number
  description = "Backup retention period in days"
  default     = 30
}

variable "backup_window" {
  type        = string
  description = "Preferred backup window"
  default     = "02:00-03:00"
}

variable "maintenance_window" {
  type        = string
  description = "Preferred maintenance window"
  default     = "sun:03:00-sun:04:00"
}

variable "deletion_protection" {
  type        = bool
  description = "Enable deletion protection"
  default     = true
}

variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ deployment"
  default     = true
}

variable "enable_performance_insights" {
  type        = bool
  description = "Enable Performance Insights"
  default     = true
}

variable "performance_insights_retention_period" {
  type        = number
  description = "Performance Insights retention period in days"
  default     = 7
}

variable "monitoring_interval" {
  type        = number
  description = "Enhanced Monitoring interval in seconds"
  default     = 60
}

variable "monitoring_role_arn" {
  type        = string
  description = "IAM role ARN for Enhanced Monitoring"
  default     = ""
}

variable "enable_cloudwatch_logs_exports" {
  type        = list(string)
  description = "List of log types to export to CloudWatch"
  default     = ["postgresql"]
}

variable "enable_read_replica" {
  type        = bool
  description = "Create a read replica"
  default     = true
}

variable "enable_encryption" {
  type        = bool
  description = "Enable encryption at rest and in transit"
  default     = true
}

variable "kms_key_arn" {
  type        = string
  description = "KMS key ARN for encryption"
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention in days"
  default     = 30
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache Redis node type"
  default     = "cache.r6g.large"
}

variable "redis_num_nodes" {
  type        = number
  description = "Number of Redis nodes"
  default     = 3
}

variable "redis_enable_failover" {
  type        = bool
  description = "Enable Redis automatic failover"
  default     = true
}

variable "redis_multi_az" {
  type        = bool
  description = "Enable Redis Multi-AZ"
  default     = true
}

variable "redis_maintenance_window" {
  type        = string
  description = "Redis maintenance window"
  default     = "sun:04:00-sun:05:00"
}

variable "redis_snapshot_window" {
  type        = string
  description = "Redis snapshot window"
  default     = "05:00-07:00"
}

variable "redis_snapshot_retention" {
  type        = number
  description = "Redis snapshot retention in days"
  default     = 7
}

variable "sns_topic_arn" {
  type        = string
  description = "SNS topic ARN for notifications"
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to resources"
  default     = {}
}
