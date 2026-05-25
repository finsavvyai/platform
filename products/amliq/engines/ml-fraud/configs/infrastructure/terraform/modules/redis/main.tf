# QuantumBeam ElastiCache Redis Module

variable "name_prefix" {
  description = "Name prefix for resources"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for Redis cluster"
  type        = list(string)
}

variable "security_groups" {
  description = "Security group IDs"
  type        = list(string)
}

variable "node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.m6g.large"
}

variable "num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 3
}

variable "automatic_failover" {
  description = "Enable automatic failover"
  type        = bool
  default     = true
}

variable "multi_az_enabled" {
  description = "Enable Multi-AZ"
  type        = bool
  default     = true
}

variable "at_rest_encryption" {
  description = "Enable encryption at rest"
  type        = bool
  default     = true
}

variable "transit_encryption" {
  description = "Enable encryption in transit"
  type        = bool
  default     = true
}

variable "auth_token" {
  description = "Auth token for Redis"
  type        = string
  sensitive   = true
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

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.name_prefix}-subnet-group"
  description = "Subnet group for ElastiCache Redis cluster"
  subnet_ids  = var.subnet_ids

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-subnet-group"
    Type = "elasticache-subnet-group"
  })
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  family = "redis7.x"

  # Performance tuning parameters
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  parameter {
    name  = "slowlog-log-slower-than"
    value = "10000"
  }

  parameter {
    name  = "slowlog-max-len"
    value = "128"
  }

  parameter {
    name  = "hash-max-ziplist-entries"
    value = "512"
  }

  parameter {
    name  = "hash-max-ziplist-value"
    value = "64"
  }

  parameter {
    name  = "list-max-ziplist-size"
    value = "-2"
  }

  parameter {
    name  = "set-max-intset-entries"
    value = "512"
  }

  parameter {
    name  = "zset-max-ziplist-entries"
    value = "128"
  }

  parameter {
    name  = "zset-max-ziplist-value"
    value = "64"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-parameter-group"
    Type = "elasticache-parameter-group"
  })
}

# ElastiCache Replication Group
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${local.name_prefix}-redis"
  description                = "QuantumBeam Redis replication group"

  node_type                  = var.node_type
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.main.name

  num_cache_clusters         = var.num_cache_nodes
  automatic_failover_enabled = var.automatic_failover
  multi_az_enabled           = var.multi_az_enabled

  at_rest_encryption_enabled = var.at_rest_encryption
  transit_encryption_enabled = var.transit_encryption
  auth_token                 = var.auth_token

  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = var.security_groups

  # Maintenance window
  maintenance_window = "sun:04:00-sun:05:00"

  # Snapshot settings
  snapshot_window          = "05:00-06:00"
  snapshot_retention_limit = 30

  # Automatic backup
  automatic_backup_retention_period = 30
  automatic_backup_copy_tags_enabled = true

  # Notification
  notification_topic_arn = aws_sns_topic.redis_alerts.arn

  # Log delivery
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  # Engine settings
  engine         = "redis"
  engine_version = "7.0"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis"
    Type = "elasticache-replication-group"
  })
}

# KMS Key for Redis encryption
resource "aws_kms_key" "redis" {
  description             = "${local.name_prefix} Redis encryption key"
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
        Sid    = "Allow ElastiCache service"
        Effect = "Allow"
        Principal = {
          Service = "elasticache.amazonaws.com"
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
    Name = "${local.name_prefix}-redis-key"
    Type = "kms-key"
  })
}

resource "aws_kms_alias" "redis" {
  name          = "alias/${local.name_prefix}-redis"
  target_key_id = aws_kms_key.redis.key_id
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "redis_slow" {
  name              = "/aws/elasticache/redis/${aws_elasticache_replication_group.main.replication_group_id}/slow"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-slow-logs"
    Type = "cloudwatch-log-group"
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${local.name_prefix}-redis-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors Redis CPU utilization"
  alarm_actions       = [aws_sns_topic.redis_alerts.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.primary_cluster_id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "${local.name_prefix}-redis-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "BytesUsedForCache"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "7516192768"  # 7GB in bytes (assuming 10GB node)
  alarm_description   = "This metric monitors Redis memory usage"
  alarm_actions       = [aws_sns_topic.redis_alerts.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.primary_cluster_id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  alarm_name          = "${local.name_prefix}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors Redis key evictions"
  alarm_actions       = [aws_sns_topic.redis_alerts.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.primary_cluster_id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "redis_connections" {
  alarm_name          = "${local.name_prefix}-redis-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "10000"
  alarm_description   = "This metric monitors Redis connections"
  alarm_actions       = [aws_sns_topic.redis_alerts.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.primary_cluster_id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "redis_replication_lag" {
  alarm_name          = "${local.name_prefix}-redis-replication-lag"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReplicationLag"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "10"
  alarm_description   = "This metric monitors Redis replication lag"
  alarm_actions       = [aws_sns_topic.redis_alerts.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.primary_cluster_id
  }

  tags = local.common_tags
}

# SNS Topic for alerts
resource "aws_sns_topic" "redis_alerts" {
  name = "${local.name_prefix}-redis-alerts"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-alerts"
    Type = "sns-topic"
  })
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.redis_alerts.arn
  protocol  = "email"
  endpoint  = "platform-team@quantumbeam.io"
}

# Data sources
data "aws_caller_identity" "current" {}

# Outputs
output "replication_group_id" {
  description = "Redis replication group ID"
  value       = aws_elasticache_replication_group.main.replication_group_id
}

output "primary_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "primary_cluster_id" {
  description = "Redis primary cluster ID"
  value       = aws_elasticache_replication_group.main.primary_cluster_id
}

output "node_type" {
  description = "Redis node type"
  value       = aws_elasticache_replication_group.main.node_type
}

output "member_clusters" {
  description = "Redis member clusters"
  value       = aws_elasticache_replication_group.main.member_clusters
}

output "subnet_group_name" {
  description = "Redis subnet group name"
  value       = aws_elasticache_subnet_group.main.name
}

output "parameter_group_name" {
  description = "Redis parameter group name"
  value       = aws_elasticache_parameter_group.main.name
}