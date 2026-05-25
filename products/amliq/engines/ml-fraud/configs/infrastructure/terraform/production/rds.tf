# Production RDS Configuration

# Random password for RDS
resource "random_password" "rds_master" {
  length  = 32
  special = true
}

# RDS Subnet Group
resource "aws_db_subnet_group" "production" {
  name       = "quantumbeam-production-db-subnet-group"
  subnet_ids = aws_subnet.database[*].id

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-db-subnet-group"
      Environment = "production"
      Type = "db-subnet-group"
    }
  )
}

# RDS Parameter Group
resource "aws_db_parameter_group" "production" {
  family = "postgres15"
  name   = "quantumbeam-production-pg-parameter-group"

  # Performance tuning parameters
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,auto_explain,pg_stat_kcache"
  }

  parameter {
    name  = "max_connections"
    value = "500"
  }

  parameter {
    name  = "shared_buffers"
    value = "256000MB"  # 25% of instance memory for 1TB instance
  }

  parameter {
    name  = "effective_cache_size"
    value = "768000MB"  # 75% of instance memory
  }

  parameter {
    name  = "work_mem"
    value = "8MB"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "2GB"
  }

  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  parameter {
    name  = "wal_buffers"
    value = "64MB"
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
    value = "300"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log slow queries > 1 second
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

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-pg-parameter-group"
      Environment = "production"
      Type = "db-parameter-group"
    }
  )
}

# RDS Option Group
resource "aws_db_option_group" "production" {
  name                 = "quantumbeam-production-option-group"
  option_group_description = "Production option group for PostgreSQL"
  engine_name          = "postgres"
  major_engine_version = "15"

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-option-group"
      Environment = "production"
      Type = "db-option-group"
    }
  )
}

# Primary RDS Cluster
resource "aws_rds_cluster" "production" {
  cluster_identifier      = "quantumbeam-production-cluster"
  engine                 = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = "15.4"
  database_name          = "quantumbeam_production"
  master_username        = "postgres"
  master_password        = random_password.rds_master.result
  db_subnet_group_name   = aws_db_subnet_group.production.name
  db_instance_parameter_group_name = aws_db_parameter_group.production.name
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.production.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = var.rds_backup_retention_period
  preferred_backup_window = var.rds_backup_window
  preferred_maintenance_window = var.rds_maintenance_window
  skip_final_snapshot = false
  final_snapshot_identifier = "quantumbeam-production-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  storage_encrypted = true
  kms_key_id = aws_kms_key.rds.arn

  deletion_protection = true
  copy_tags_to_snapshot = true

  backup_retention_period = 35  # 35 days for production
  preferred_backup_window = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  # Enhanced monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  # Performance insights
  performance_insights_enabled = true
  performance_insights_retention_period = 730  # 2 years

  # CloudWatch logs
  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-rds-cluster"
      Environment = "production"
      Type = "aurora-postgresql-cluster"
    }
  )
}

# RDS Cluster Instances
resource "aws_rds_cluster_instance" "writer" {
  identifier = "quantumbeam-production-writer"
  cluster_identifier = aws_rds_cluster.production.id
  instance_class = var.rds_instance_class
  engine = aws_rds_cluster.production.engine
  engine_version = aws_rds_cluster.production.engine_version
  db_parameter_group_name = aws_db_parameter_group.production.name
  db_subnet_group_name = aws_db_subnet_group.production.name

  publicly_accessible = false
  storage_encrypted = true

  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  performance_insights_enabled = true
  performance_insights_retention_period = 730

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-rds-writer"
      Environment = "production"
      Type = "aurora-postgresql-instance"
      Role = "writer"
    }
  )
}

resource "aws_rds_cluster_instance" "reader" {
  count = 2
  identifier = "quantumbeam-production-reader-${count.index + 1}"
  cluster_identifier = aws_rds_cluster.production.id
  instance_class = var.rds_instance_class
  engine = aws_rds_cluster.production.engine
  engine_version = aws_rds_cluster.production.engine_version
  db_parameter_group_name = aws_db_parameter_group.production.name
  db_subnet_group_name = aws_db_subnet_group.production.name

  publicly_accessible = false
  storage_encrypted = true

  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  performance_insights_enabled = true
  performance_insights_retention_period = 730

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-rds-reader-${count.index + 1}"
      Environment = "production"
      Type = "aurora-postgresql-instance"
      Role = "reader"
    }
  )
}

# RDS Cluster Parameter Group
resource "aws_rds_cluster_parameter_group" "production" {
  family = "aurora-postgresql15"
  name   = "quantumbeam-production-cluster-parameter-group"

  # Aurora-specific parameters
  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,auto_explain"
  }

  parameter {
    name  = "auto_explain.log_min_duration"
    value = "1000"
  }

  parameter {
    name  = "auto_explain.log_analyze"
    value = "1"
  }

  parameter {
    name  = "auto_explain.log_verbose"
    value = "1"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-cluster-parameter-group"
      Environment = "production"
      Type = "db-cluster-parameter-group"
    }
  )
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name        = "quantumbeam-production-rds-sg"
  description = "Security group for RDS cluster"
  vpc_id      = aws_vpc.production.id

  # Allow connections from EKS nodes
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  # Allow connections from bastion host for administration
  ingress {
    from_port       = 5432
    to_port         = 5432
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
      Name = "quantumbeam-production-rds-sg"
      Environment = "production"
      Type = "security-group"
    }
  )
}

# Enhanced Monitoring IAM Role
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "quantumbeam-production-rds-enhanced-monitoring"

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

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-rds-enhanced-monitoring-role"
    }
  )
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
  role       = aws_iam_role.rds_enhanced_monitoring.name
}

# RDS Event Subscription
resource "aws_db_event_subscription" "production" {
  name      = "quantumbeam-production-events"
  sns_topic = aws_sns_topic.rds_events.arn

  source_type = "db-cluster"
  source_ids  = [aws_rds_cluster.production.id]

  event_categories = [
    "availability",
    "backup",
    "configuration change",
    "failover",
    "maintenance",
    "notification",
    "recovery",
    "restoration"
  ]

  enabled = true

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-rds-events"
      Environment = "production"
      Type = "db-event-subscription"
    }
  )
}

# SNS Topic for RDS Events
resource "aws_sns_topic" "rds_events" {
  name = "quantumbeam-production-rds-events"

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-rds-events-sns"
      Environment = "production"
      Type = "sns-topic"
    }
  )
}

# SNS Topic Subscription for RDS Events
resource "aws_sns_topic_subscription" "rds_events_email" {
  topic_arn = aws_sns_topic.rds_events.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# RDS Automated Backups
resource "aws_s3_bucket" "rds_backups" {
  bucket        = "quantumbeam-production-rds-backups-${random_string.suffix.result}"
  force_destroy = true

  lifecycle_rule {
    id     = "rds_backup_retention"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = 2555  # 7 years
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-rds-backups"
      Environment = "production"
      Type = "s3-bucket"
      Purpose = "rds-backups"
    }
  )
}

resource "aws_s3_bucket_versioning" "rds_backups" {
  bucket = aws_s3_bucket.rds_backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "rds_backups" {
  bucket = aws_s3_bucket.rds_backups.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.rds.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "rds_backups" {
  bucket                  = aws_s3_bucket.rds_backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# RDS Performance Insights
resource "aws_rds_cluster_performance_insights" "production" {
  cluster_identifier = aws_rds_cluster.production.id

  enabled = true
  retention_period = 730  # 2 years for production

  depends_on = [aws_rds_cluster.production]
}

# Cross-Region Read Replica (if enabled)
resource "aws_rds_cluster" "dr_replica" {
  count = var.enable_cross_region_backup ? 1 : 0

  provider = aws.backup_region

  cluster_identifier      = "quantumbeam-production-dr-replica"
  engine                 = aws_rds_cluster.production.engine
  engine_version         = aws_rds_cluster.production.engine_version
  database_name          = aws_rds_cluster.production.database_name
  master_username        = aws_rds_cluster.production.master_username
  master_password        = random_password.rds_master.result
  db_subnet_group_name   = aws_db_subnet_group.dr[0].name
  db_instance_parameter_group_name = aws_db_parameter_group.dr[0].name
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.dr[0].name
  vpc_security_group_ids = [aws_security_group.rds_dr[0].id]

  replication_source_identifier = aws_rds_cluster.production.arn

  storage_encrypted = true
  kms_key_id = aws_kms_key.rds_dr[0].arn

  skip_final_snapshot = false
  final_snapshot_identifier = "quantumbeam-production-dr-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  backup_retention_period = 35
  preferred_backup_window = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  monitoring_interval = 60
  performance_insights_enabled = true
  performance_insights_retention_period = 730

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-dr-replica"
      Environment = "production"
      Type = "aurora-postgresql-cluster"
      Purpose = "disaster-recovery"
    }
  )
}