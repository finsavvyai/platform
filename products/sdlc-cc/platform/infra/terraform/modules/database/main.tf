# Database Module for SDLC.ai Platform
# Creates secure, highly available database infrastructure

# Random password for database
resource "random_password" "database" {
  length  = 32
  special = true
}

# Store password in AWS Secrets Manager
resource "aws_secretsmanager_secret" "database" {
  name                    = "${var.name_prefix}/database"
  description             = "Database credentials for ${var.name_prefix}"
  recovery_window_in_days = 0

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-database-secret"
      Type = "Secrets Manager Secret"
    }
  )
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username = var.database_username
    password = random_password.database.result
    engine   = "postgres"
    host     = aws_db_instance.primary.endpoint
    port     = aws_db_instance.primary.port
    dbname   = aws_db_instance.primary.db_name
  })
}

# Database subnet group (using provided from VPC module)
resource "aws_db_subnet_group" "database" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = var.database_subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-db-subnet-group"
      Type = "Database Subnet Group"
    }
  )
}

# Database parameter group
resource "aws_db_parameter_group" "postgres" {
  family = "postgres15"
  name   = "${var.name_prefix}-postgres-parameter-group"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,pg_stat_kcache,pg_qualstats"
  }

  parameter {
    name  = "pg_stat_statements.track"
    value = "all"
  }

  parameter {
    name  = "pg_stat_statements.max"
    value = "10000"
  }

  parameter {
    name  = "max_connections"
    value = "200"
  }

  parameter {
    name  = "shared_buffers"
    value = "256MB"
  }

  parameter {
    name  = "effective_cache_size"
    value = "1GB"
  }

  parameter {
    name  = "work_mem"
    value = "4MB"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "64MB"
  }

  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  parameter {
    name  = "wal_buffers"
    value = "16MB"
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

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-postgres-parameter-group"
      Type = "DB Parameter Group"
    }
  )
}

# Database option group for enhanced monitoring
resource "aws_db_option_group" "postgres" {
  name                     = "${var.name_prefix}-postgres-option-group"
  option_group_description = "Option group for PostgreSQL"
  engine_name              = "postgres"
  major_engine_version     = "15"

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-postgres-option-group"
      Type = "DB Option Group"
    }
  )
}

# Primary Database Instance
resource "aws_db_instance" "primary" {
  identifier = "${var.name_prefix}-postgres-primary"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = var.enable_encryption
  kms_key_id            = var.kms_key_arn

  db_name  = var.database_name
  username = var.database_username
  password = random_password.database.result

  port = 5432

  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = aws_db_subnet_group.database.name

  backup_retention_period = var.backup_retention_period
  backup_window           = var.backup_window
  maintenance_window      = var.maintenance_window

  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.name_prefix}-postgres-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  deletion_protection = var.deletion_protection

  multi_az = var.multi_az

  performance_insights_enabled          = var.enable_performance_insights
  performance_insights_retention_period = var.performance_insights_retention

  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_role_arn

  enabled_cloudwatch_logs_exports = var.enable_cloudwatch_logs_exports

  parameter_group_name = aws_db_parameter_group.postgres.name
  option_group_name    = aws_db_option_group.postgres.name

  copy_tags_to_snapshot = true

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-postgres-primary"
      Type = "Database Instance"
      Role = "Primary"
    }
  )
}

# Read Replica for read-heavy workloads
resource "aws_db_instance" "read_replica" {
  count = var.enable_read_replica ? 1 : 0

  identifier = "${var.name_prefix}-postgres-replica"

  replicate_source_db = aws_db_instance.primary.identifier

  instance_class = var.replica_instance_class

  port = 5432

  vpc_security_group_ids = [aws_security_group.database.id]

  skip_final_snapshot = true
  deletion_protection = false

  performance_insights_enabled          = var.enable_performance_insights
  performance_insights_retention_period = var.performance_insights_retention

  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_role_arn

  enabled_cloudwatch_logs_exports = var.enable_cloudwatch_logs_exports

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-postgres-replica"
      Type = "Database Instance"
      Role = "Read Replica"
    }
  )

  depends_on = [aws_db_instance.primary]
}

# Database Security Group
resource "aws_security_group" "database" {
  name        = "${var.name_prefix}-database-sg"
  description = "Security group for RDS database"
  vpc_id      = var.vpc_id

  # PostgreSQL access from application
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  # PostgreSQL access from bastion
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.bastion_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-database-sg"
      Type = "Security Group"
    }
  )
}

# Redis (ElastiCache) for caching
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.name_prefix}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-redis-subnet-group"
      Type = "ElastiCache Subnet Group"
    }
  )
}

resource "random_password" "redis" {
  length  = 64
  special = false
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.name_prefix}-redis"
  description          = "Redis cluster for ${var.name_prefix}"

  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = "default.redis7"

  num_cache_clusters         = var.redis_num_nodes
  automatic_failover_enabled = var.redis_enable_failover
  multi_az_enabled           = var.redis_multi_az

  at_rest_encryption_enabled = var.enable_encryption
  transit_encryption_enabled = var.enable_encryption
  auth_token                 = random_password.redis.result
  kms_key_id                 = var.kms_key_arn

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  maintenance_window       = var.redis_maintenance_window
  snapshot_window          = var.redis_snapshot_window
  snapshot_retention_limit = var.redis_snapshot_retention

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-redis"
      Type = "ElastiCache Redis"
    }
  )
}

# Redis Security Group
resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis-sg"
  description = "Security group for Redis"
  vpc_id      = var.vpc_id

  # Redis access from application
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  # Redis access from bastion
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.bastion_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-redis-sg"
      Type = "Security Group"
    }
  )
}

# CloudWatch Log Group for Redis
resource "aws_cloudwatch_log_group" "redis_slow" {
  name              = "/aws/elasticache/redis/${var.name_prefix}/slow-log"
  retention_in_days = var.log_retention_days

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-redis-slow-log"
      Type = "CloudWatch Log Group"
    }
  )
}

# Store Redis password in Secrets Manager
resource "aws_secretsmanager_secret" "redis" {
  name                    = "${var.name_prefix}/redis"
  description             = "Redis credentials for ${var.name_prefix}"
  recovery_window_in_days = 0

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-redis-secret"
      Type = "Secrets Manager Secret"
    }
  )
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id = aws_secretsmanager_secret.redis.id
  secret_string = jsonencode({
    host     = aws_elasticache_replication_group.redis.primary_endpoint_address
    port     = aws_elasticache_replication_group.redis.port
    password = random_password.redis.result
  })
}

# Database Backup using AWS Backup
resource "aws_backup_vault" "database" {
  name = "${var.name_prefix}-database-backup-vault"

  kms_key_arn = var.kms_key_arn

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-database-backup-vault"
      Type = "Backup Vault"
    }
  )
}

resource "aws_backup_plan" "database" {
  name = "${var.name_prefix}-database-backup-plan"

  rule {
    name             = "daily-backups"
    target_vault_arn = aws_backup_vault.database.arn
    schedule         = "cron(0 2 ? * * *)"

    lifecycle {
      delete_after = var.backup_retention_days
    }

    recovery_point_tags = merge(
      var.tags,
      {
        Name = "${var.name_prefix}-database-backup"
        Type = "Backup Recovery Point"
      }
    )
  }

  rule {
    name             = "weekly-backups"
    target_vault_arn = aws_backup_vault.database.arn
    schedule         = "cron(0 3 ? * SUN *)"

    lifecycle {
      delete_after = var.backup_retention_days * 4
    }

    recovery_point_tags = merge(
      var.tags,
      {
        Name = "${var.name_prefix}-database-weekly-backup"
        Type = "Backup Recovery Point"
      }
    )
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-database-backup-plan"
      Type = "Backup Plan"
    }
  )
}

resource "aws_backup_selection" "database" {
  iam_role_arn = aws_iam_role.backup.arn
  name         = "${var.name_prefix}-database-selection"
  plan_id      = aws_backup_plan.database.id

  resources = [
    aws_db_instance.primary.arn,
    aws_elasticache_replication_group.redis.arn
  ]
}

resource "aws_iam_role" "backup" {
  name = "${var.name_prefix}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-backup-role"
      Type = "IAM Role"
    }
  )
}

resource "aws_iam_role_policy_attachment" "backup_service" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
  role       = aws_iam_role.backup.name
}

# Database Event Subscription for monitoring
resource "aws_db_event_subscription" "main" {
  name      = "${var.name_prefix}-db-events"
  sns_topic = var.sns_topic_arn

  source_type = "db-instance"

  event_categories = [
    "availability",
    "backup",
    "configuration change",
    "creation",
    "deletion",
    "failover",
    "maintenance",
    "notification",
    "recovery",
    "restoration"
  ]

  source_ids = [aws_db_instance.primary.id]

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-db-events"
      Type = "Event Subscription"
    }
  )
}
