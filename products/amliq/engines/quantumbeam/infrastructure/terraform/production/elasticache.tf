# Production ElastiCache Configuration

# Random password for Redis
resource "random_password" "elasticache_auth" {
  length  = 64
  special = false
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "production" {
  name       = "quantumbeam-production-elasticache-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-elasticache-subnet-group"
      Environment = "production"
      Type = "elasticache-subnet-group"
    }
  )
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "production" {
  family = "redis7.x"
  name   = "quantumbeam-production-redis-parameter-group"

  # Performance tuning parameters
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "maxmemory"
    value = "80%"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "60"
  }

  parameter {
    name  = "databases"
    value = "16"
  }

  parameter {
    name  = "save"
    value = "900 1 300 10 60 10000"  # Standard Redis save configuration
  }

  parameter {
    name  = "appendonly"
    value = "yes"
  }

  parameter {
    name  = "appendfsync"
    value = "everysec"
  }

  parameter {
    name  = "no-appendfsync-on-rewrite"
    value = "no"
  }

  parameter {
    name  = "auto-aof-rewrite-percentage"
    value = "100"
  }

  parameter {
    name  = "auto-aof-rewrite-min-size"
    value = "64mb"
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
    name  = "list-compress-depth"
    value = "0"
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

  parameter {
    name  = "hll-sparse-max-bytes"
    value = "3000"
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
    name  = "latency-monitor-threshold"
    value = "100"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-redis-parameter-group"
      Environment = "production"
      Type = "elasticache-parameter-group"
    }
  )
}

# ElastiCache Replication Group (Redis Cluster)
resource "aws_elasticache_replication_group" "production" {
  replication_group_id       = "quantumbeam-production-redis"
  description               = "Production Redis cluster for QuantumBeam"
  engine                    = "redis"
  engine_version            = "7.0"
  node_type                 = var.elasticache_node_type
  port                      = 6379
  parameter_group_name      = aws_elasticache_parameter_group.production.name
  subnet_group_name         = aws_elasticache_subnet_group.production.name
  security_group_ids        = [aws_security_group.elasticache.id]
  num_cache_clusters        = var.elasticache_num_cache_nodes
  automatic_failover_enabled = true
  multi_az_enabled          = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.elasticache_auth.result
  kms_key_id                = aws_kms_key.elasticache.arn

  # Backup configuration
  snapshot_retention_limit = 35  # 35 days for production
  snapshot_window         = "05:00-07:00"
  maintenance_window      = "sun:06:00-sun:07:00"

  # Notification configuration
  notification_topic_arn = aws_sns_topic.elasticache_events.arn

  # Logging configuration
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-redis-cluster"
      Environment = "production"
      Type = "elasticache-replication-group"
    }
  )
}

# ElastiCache Security Group
resource "aws_security_group" "elasticache" {
  name        = "quantumbeam-production-elasticache-sg"
  description = "Security group for ElastiCache cluster"
  vpc_id      = aws_vpc.production.id

  # Allow connections from EKS nodes
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  # Allow connections from bastion host for administration
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }

  # Egress rules (limited)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-elasticache-sg"
      Environment = "production"
      Type = "security-group"
    }
  )
}

# CloudWatch Log Group for Redis Slow Logs
resource "aws_cloudwatch_log_group" "redis_slow" {
  name              = "/aws/elasticache/redis/slow-log"
  retention_in_days = 14

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-redis-slow-logs"
      Environment = "production"
      Type = "cloudwatch-log-group"
    }
  )
}

# SNS Topic for ElastiCache Events
resource "aws_sns_topic" "elasticache_events" {
  name = "quantumbeam-production-elasticache-events"

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-elasticache-events-sns"
      Environment = "production"
      Type = "sns-topic"
    }
  )
}

# SNS Topic Subscription for ElastiCache Events
resource "aws_sns_topic_subscription" "elasticache_events_email" {
  topic_arn = aws_sns_topic.elasticache_events.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ElastiCache Event Subscriptions
resource "aws_elasticache_replication_group" "production_events" {
  depends_on = [aws_elasticache_replication_group.production]
}

# Additional Redis for Session Storage (if needed)
resource "aws_elasticache_replication_group" "session_storage" {
  replication_group_id       = "quantumbeam-production-redis-sessions"
  description               = "Production Redis cluster for session storage"
  engine                    = "redis"
  engine_version            = "7.0"
  node_type                 = "cache.r6g.large"
  port                      = 6380
  parameter_group_name      = aws_elasticache_parameter_group.production.name
  subnet_group_name         = aws_elasticache_subnet_group.production.name
  security_group_ids        = [aws_security_group.elasticache_sessions.id]
  num_cache_clusters        = 2
  automatic_failover_enabled = true
  multi_az_enabled          = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.elasticache_sessions_auth.result

  # Backup configuration for session storage (shorter retention)
  snapshot_retention_limit = 7
  snapshot_window         = "02:00-03:00"
  maintenance_window      = "sun:03:00-sun:04:00"

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-redis-sessions"
      Environment = "production"
      Type = "elasticache-replication-group"
      Purpose = "session-storage"
    }
  )
}

# Random password for session storage Redis
resource "random_password" "elasticache_sessions_auth" {
  length  = 64
  special = false
}

# Security Group for Session Storage Redis
resource "aws_security_group" "elasticache_sessions" {
  name        = "quantumbeam-production-elasticache-sessions-sg"
  description = "Security group for ElastiCache session storage cluster"
  vpc_id      = aws_vpc.production.id

  # Allow connections from EKS nodes
  ingress {
    from_port       = 6380
    to_port         = 6380
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  # Allow connections from bastion host
  ingress {
    from_port       = 6380
    to_port         = 6380
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-elasticache-sessions-sg"
      Environment = "production"
      Type = "security-group"
      Purpose = "session-storage"
    }
  )
}

# Redis for Caching Layer (Read Cache)
resource "aws_elasticache_replication_group" "read_cache" {
  replication_group_id       = "quantumbeam-production-redis-cache"
  description               = "Production Redis cluster for read caching"
  engine                    = "redis"
  engine_version            = "7.0"
  node_type                 = "cache.r6g.2xlarge"
  port                      = 6381
  parameter_group_name      = aws_elasticache_parameter_group.production.name
  subnet_group_name         = aws_elasticache_subnet_group.production.name
  security_group_ids        = [aws_security_group.elasticache_cache.id]
  num_cache_clusters        = 3
  automatic_failover_enabled = true
  multi_az_enabled          = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.elasticache_cache_auth.result

  # Configuration optimized for caching
  snapshot_retention_limit = 7
  snapshot_window         = "01:00-02:00"
  maintenance_window      = "sun:02:00-sun:03:00"

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-redis-cache"
      Environment = "production"
      Type = "elasticache-replication-group"
      Purpose = "read-cache"
    }
  )
}

# Random password for cache Redis
resource "random_password" "elasticache_cache_auth" {
  length  = 64
  special = false
}

# Security Group for Cache Redis
resource "aws_security_group" "elasticache_cache" {
  name        = "quantumbeam-production-elasticache-cache-sg"
  description = "Security group for ElastiCache read cache cluster"
  vpc_id      = aws_vpc.production.id

  # Allow connections from EKS nodes
  ingress {
    from_port       = 6381
    to_port         = 6381
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  # Allow connections from bastion host
  ingress {
    from_port       = 6381
    to_port         = 6381
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-elasticache-cache-sg"
      Environment = "production"
      Type = "security-group"
      Purpose = "read-cache"
    }
  )
}

# CloudWatch Alarms for Redis
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "quantumbeam-production-redis-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors Redis CPU utilization"
  alarm_actions       = [aws_sns_topic.elasticache_events.arn]

  dimensions = {
    CacheClusterId = element(aws_elasticache_replication_group.production.cache_clusters[0].id, 0)
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-redis-cpu-alarm"
      Environment = "production"
      Type = "cloudwatch-alarm"
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "quantumbeam-production-redis-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "90"
  alarm_description   = "This metric monitors Redis memory usage"
  alarm_actions       = [aws_sns_topic.elasticache_events.arn]

  dimensions = {
    CacheClusterId = element(aws_elasticache_replication_group.production.cache_clusters[0].id, 0)
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-redis-memory-alarm"
      Environment = "production"
      Type = "cloudwatch-alarm"
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "redis_connections" {
  alarm_name          = "quantumbeam-production-redis-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "1000"
  alarm_description   = "This metric monitors Redis connections"
  alarm_actions       = [aws_sns_topic.elasticache_events.arn]

  dimensions = {
    CacheClusterId = element(aws_elasticache_replication_group.production.cache_clusters[0].id, 0)
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-redis-connections-alarm"
      Environment = "production"
      Type = "cloudwatch-alarm"
    }
  )
}