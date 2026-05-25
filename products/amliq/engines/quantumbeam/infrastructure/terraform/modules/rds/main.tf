# QuantumBeam RDS Database Module

variable "name_prefix" {
  description = "Name prefix for resources"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "Database subnet IDs"
  type        = list(string)
}

variable "security_groups" {
  description = "Security group IDs"
  type        = list(string)
}

variable "database_name" {
  description = "Database name"
  type        = string
}

variable "username" {
  description = "Database username"
  type        = string
}

variable "password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.m6i.large"
}

variable "engine" {
  description = "Database engine"
  type        = string
  default     = "postgresql"
}

variable "engine_version" {
  description = "Database engine version"
  type        = string
  default     = "15.4"
}

variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 30
}

variable "backup_window" {
  description = "Backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "storage_type" {
  type        = string
  default     = "io1"
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 1000
}

variable "iops" {
  description = "IOPS for storage"
  type        = number
  default     = 3000
}

variable "common_tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}

locals {
  name_prefix = var.name_prefix
  common_tags = var.common_tags
}

# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-subnet-group"
  description = "Subnet group for RDS database"
  subnet_ids  = var.subnet_ids

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-subnet-group"
    Type = "rds-subnet-group"
  })
}

# RDS Parameter Group
resource "aws_db_parameter_group" "main" {
  family = "${var.engine}${split(".", var.engine_version)[0]}.${split(".", var.engine_version)[1]}"

  # PostgreSQL performance tuning parameters
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,pg_stat_kcache,auto_explain"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "log_checkpoints"
    value = "1"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_lock_waits"
    value = "1"
  }

  parameter {
    name  = "log_temp_files"
    value = "0"
  }

  parameter {
    name  = "max_connections"
    value = "200"
  }

  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceMemory * 0.25}"
  }

  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceMemory * 0.75}"
  }

  parameter {
    name  = "work_mem"
    value = "{DBInstanceMemory / max_connections / 4}"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "{DBInstanceMemory * 0.1}"
  }

  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  parameter {
    name  = "wal_buffers"
    value = "16384"
  }

  parameter {
    name  = "default_statistics_target"
    value = "100"
  }

  parameter {
    name  = "random_page_cost"
    value = "1.1"
  }

  parameter {
    name  = "effective_io_concurrency"
    value = "200"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-parameter-group"
    Type = "rds-parameter-group"
  })
}

# RDS Option Group
resource "aws_db_option_group" "main" {
  name                 = "${local.name_prefix}-option-group"
  description          = "Option group for RDS database"
  engine_name          = var.engine
  major_engine_version = "${split(".", var.engine_version)[0]}.${split(".", var.engine_version)[1]}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-option-group"
    Type = "rds-option-group"
  })
}

# Main RDS Instance
resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-db"

  engine         = var.engine
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  storage_type          = var.storage_type
  iops                  = var.iops
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.main.arn

  db_name  = var.database_name
  username = var.username
  password = var.password

  port = 5432

  vpc_security_group_ids = var.security_groups
  db_subnet_group_name   = aws_db_subnet_group.main.name

  parameter_group_name = aws_db_parameter_group.main.name
  option_group_name    = aws_db_option_group.main.name

  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window

  # High availability
  multi_az                = true
  storage_autoscaling     = true
  max_allocated_storage   = var.allocated_storage * 3

  # Performance monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = "7"
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_enhanced_monitoring.arn

  # Deletion protection
  deletion_protection = true

  # Backup and snapshot settings
  copy_tags_to_snapshot = true
  delete_automated_backups = false

  skip_final_snapshot = false
  final_snapshot_identifier = "${local.name_prefix}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db"
    Type = "rds-instance"
  })

  depends_on = [aws_kms_key.main]
}

# Read Replica
resource "aws_db_instance" "read_replica" {
  count = 1  # Can be increased for more read replicas

  identifier = "${local.name_prefix}-read-replica-${count.index + 1}"

  replicate_source_db = aws_db_instance.main.identifier

  instance_class = var.instance_class

  vpc_security_group_ids = var.security_groups
  db_subnet_group_name   = aws_db_subnet_group.main.name

  parameter_group_name = aws_db_parameter_group.main.name
  option_group_name    = aws_db_option_group.main.name

  # Performance monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = "7"
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_enhanced_monitoring.arn

  # Backup settings
  backup_retention_period = 7
  backup_window          = "04:00-05:00"

  skip_final_snapshot = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-read-replica-${count.index + 1}"
    Type = "rds-read-replica"
  })
}

# KMS Key for RDS encryption
resource "aws_kms_key" "main" {
  description             = "${local.name_prefix} RDS encryption key"
  deletion_window_in_days = 7

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow RDS service"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-key"
    Type = "kms-key"
  })
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name_prefix}-rds"
  target_key_id = aws_kms_key.main.key_id
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${local.name_prefix}-rds-enhanced-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# CloudWatch Logs
resource "aws_cloudwatch_log_group" "postgresql" {
  name              = "/aws/rds/instance/${aws_db_instance.main.identifier}/postgresql"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgresql-logs"
    Type = "cloudwatch-log-group"
  })
}

resource "aws_cloudwatch_log_group" "slow_query" {
  name              = "/aws/rds/instance/${aws_db_instance.main.identifier}/slowquery"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-slow-query-logs"
    Type = "cloudwatch-log-group"
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  alarm_name          = "${local.name_prefix}-rds-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ec2 cpu utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "memory_utilization" {
  alarm_name          = "${local.name_prefix}-rds-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "268435456"  # 256MB in bytes
  alarm_description   = "This metric monitors RDS freeable memory"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "storage_utilization" {
  alarm_name          = "${local.name_prefix}-rds-high-storage"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "10737418240"  # 10GB in bytes
  alarm_description   = "This metric monitors RDS free storage space"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "${local.name_prefix}-rds-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "150"
  alarm_description   = "This metric monitors RDS database connections"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = local.common_tags
}

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-rds-alerts"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-alerts"
    Type = "sns-topic"
  })
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = "platform-team@quantumbeam.io"
}

# Data sources
data "aws_caller_identity" "current" {}

# Outputs
output "instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.main.identifier
}

output "instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "instance_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.main.arn
}

output "instance_status" {
  description = "RDS instance status"
  value       = aws_db_instance.main.status
}

output "read_replica_ids" {
  description = "Read replica IDs"
  value       = aws_db_instance.read_replica[*].identifier
}

output "subnet_group_name" {
  description = "DB subnet group name"
  value       = aws_db_subnet_group.main.name
}

output "parameter_group_name" {
  description = "DB parameter group name"
  value       = aws_db_parameter_group.main.name
}

output "option_group_name" {
  description = "DB option group name"
  value       = aws_db_option_group.main.name
}