# Local variables for QuantumBeam infrastructure

locals {
  # Availability zones based on region
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)

  # Common tags
  common_tags = merge(
    var.tags,
    {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
    }
  )

  # Cluster naming conventions
  cluster_name = "${var.project_name}-${var.environment}-eks"

  # Security group naming
  security_group_names = {
    cluster = "${var.project_name}-${var.environment}-cluster-sg"
    node    = "${var.project_name}-${var.environment}-node-sg"
    rds     = "${var.project_name}-${var.environment}-rds-sg"
    redis   = "${var.project_name}-${var.environment}-redis-sg"
  }

  # IAM role naming
  iam_role_names = {
    cluster           = "${var.project_name}-${var.environment}-cluster-role"
    node_general      = "${var.project_name}-${var.environment}-general-node-role"
    node_quantum      = "${var.project_name}-${var.environment}-quantum-node-role"
    node_ai_ml        = "${var.project_name}-${var.environment}-ai-ml-node-role"
    external_dns      = "${var.project_name}-${var.environment}-external-dns"
    cert_manager      = "${var.project_name}-${var.environment}-cert-manager"
    rds_monitoring   = "${var.project_name}-${var.environment}-rds-monitoring"
  }

  # S3 bucket naming
  s3_bucket_names = {
    application_storage = "${var.project_name}-${var.environment}-app-storage-${random_string.suffix.result}"
    backups             = "${var.project_name}-${var.environment}-backups-${random_string.suffix.result}"
    terraform_state     = "${var.project_name}-${var.environment}-terraform-state"
    logs                = "${var.project_name}-${var.environment}-logs"
  }

  # Database configuration
  database_config = {
    engine         = "postgres"
    engine_version = "15.4"
    instance_class = "db.m6i.large"
    allocated_storage = 100
    max_allocated_storage = 1000
    storage_encrypted = true
    backup_retention_period = 30
    multi_az = true
  }

  # Redis configuration
  redis_config = {
    engine_version = "7.0"
    node_type      = "cache.r6g.large"
    num_cache_clusters = 3
    automatic_failover_enabled = true
    multi_az_enabled = true
    at_rest_encryption_enabled = true
    transit_encryption_enabled = true
    snapshot_retention_limit = 7
  }

  # Monitoring configuration
  monitoring_config = {
    enabled = var.enable_monitoring
    log_retention_days = 30
    metrics_retention_days = 15
    alarm_actions = ["arn:aws:sns:${var.aws_region}:${data.aws_caller_identity.current.account_id}:quantumbeam-alerts"]
  }

  # Backup configuration
  backup_config = {
    enabled = var.enable_backup
    retention_days = 30
    cross_region_backup = true
    backup_regions = ["us-west-2"]
  }

  # Node group configurations
  node_groups = {
    general = {
      instance_types = ["m6i.xlarge", "m6a.xlarge"]
      min_size      = 3
      max_size      = 10
      desired_size  = 3
      disk_size     = 100
      k8s_labels = {
        role    = "general"
        project = var.project_name
      }
    }
    quantum = {
      instance_types = ["c6i.2xlarge", "c6a.2xlarge"]
      min_size      = 2
      max_size      = 5
      desired_size  = 2
      disk_size     = 200
      k8s_labels = {
        role    = "quantum"
        project = var.project_name
      }
      taints = {
        quantum = {
          key    = "workload"
          value  = "quantum"
          effect = "NO_SCHEDULE"
        }
      }
    }
    ai_ml = {
      instance_types = ["g5.xlarge", "g4dn.xlarge"]
      min_size      = 2
      max_size      = 6
      desired_size  = 2
      disk_size     = 500
      k8s_labels = {
        role    = "ai-ml"
        project = var.project_name
      }
      taints = {
        ai_ml = {
          key    = "workload"
          value  = "ai-ml"
          effect = "NO_SCHEDULE"
        }
      }
    }
  }

  # Network configuration
  network_config = {
    vpc_cidr             = var.vpc_cidr
    enable_nat_gateway   = true
    single_nat_gateway   = false
    one_nat_gateway_per_az = true
    enable_dns_hostnames = true
    enable_dns_support   = true
  }

  # Security configuration
  security_config = {
    enable_flow_log                      = true
    flow_log_destination_type            = "cloud-watch-logs"
    flow_log_cloudwatch_log_group_retention = 30
    enable_encryption_at_rest            = true
    enable_encryption_in_transit         = true
  }
}