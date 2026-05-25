# QuantumBeam Production Infrastructure
# Terraform configuration for AWS EKS deployment

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # Backend configuration for state management
  backend "s3" {
    bucket = "quantumbeam-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"

    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

# Provider configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "QuantumBeam"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = var.owner
    }
  }
}

# Data sources for AWS resources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Random resources for unique naming
resource "random_pet" "unique_name" {
  length = 2
}

resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "~> 5.5"

  name = "${var.project_name}-${var.environment}-vpc"
  cidr = var.vpc_cidr

  azs             = local.availability_zones
  private_subnets = [for i in range(length(local.availability_zones)) : cidrsubnet(var.vpc_cidr, 8, i * 2)]
  public_subnets  = [for i in range(length(local.availability_zones)) : cidrsubnet(var.vpc_cidr, 8, i * 2 + 1)]

  enable_nat_gateway     = true
  single_nat_gateway     = false
  one_nat_gateway_per_az = true

  enable_dns_hostnames = true
  enable_dns_support   = true

  # VPC Flow Logs for security monitoring
  enable_flow_log                      = true
  flow_log_destination_type            = "cloud-watch-logs"
  flow_log_log_group_name_prefix       = "/aws/vpc-flow-logs/"
  flow_log_cloudwatch_log_group_retention = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }
}

# EKS Cluster Configuration
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  version = "~> 19.15"

  cluster_name    = "${var.project_name}-${var.environment}-eks"
  cluster_version = var.kubernetes_version

  cluster_endpoint_public_access  = false
  cluster_endpoint_private_access = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # EKS Add-ons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  # Managed Node Groups
  managed_node_groups = {
    general = {
      name       = "${var.project_name}-${var.environment}-general-nodes"
      role_name  = "${var.project_name}-${var.environment}-general-node-role"
      instance_types = ["m6i.xlarge", "m6a.xlarge"]

      min_size     = 3
      max_size     = 10
      desired_size = 3

      subnet_ids = module.vpc.private_subnets

      k8s_labels = {
        role    = "general"
        project = var.project_name
      }

      taints = []

      # Enhanced security and monitoring
      iam_role_additional_policies = {
        AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
        CloudWatchAgentServerPolicy  = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
      }

      # Node group security configuration
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size = 100
            volume_type = "gp3"
            iops        = 3000
            throughput  = 125
            encrypted   = true
          }
        }
      }

      # Launch template configuration
      launch_template_name = "${var.project_name}-${var.environment}-general-lt"
      launch_template_tags = {
        Name = "${var.project_name}-${var.environment}-general-launch-template"
      }

      # Autoscaling configuration
      cluster_autoscaler_enabled = true
      autoscaling_group_tags = {
        "k8s.io/cluster-autoscaler/${var.project_name}-${var.environment}-eks" = "owned"
        "k8s.io/cluster-autoscaler/enabled"                                 = "true"
      }
    }

    quantum = {
      name       = "${var.project_name}-${var.environment}-quantum-nodes"
      role_name  = "${var.project_name}-${var.environment}-quantum-node-role"
      instance_types = ["c6i.2xlarge", "c6a.2xlarge"]

      min_size     = 2
      max_size     = 5
      desired_size = 2

      subnet_ids = module.vpc.private_subnets

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

      # Quantum-specific configuration
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size = 200
            volume_type = "gp3"
            iops        = 6000
            throughput  = 250
            encrypted   = true
          }
        }
      }

      # Enhanced security for quantum workloads
      iam_role_additional_policies = {
        AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
        CloudWatchAgentServerPolicy  = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
      }
    }

    ai-ml = {
      name       = "${var.project_name}-${var.environment}-ai-ml-nodes"
      role_name  = "${var.project_name}-${var.environment}-ai-ml-node-role"
      instance_types = ["g5.xlarge", "g4dn.xlarge"]

      min_size     = 2
      max_size     = 6
      desired_size = 2

      subnet_ids = module.vpc.private_subnets

      k8s_labels = {
        role    = "ai-ml"
        project = var.project_name
      }

      taints = {
        ai-ml = {
          key    = "workload"
          value  = "ai-ml"
          effect = "NO_SCHEDULE"
        }
      }

      # AI/ML specific configuration with GPU support
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size = 500
            volume_type = "gp3"
            iops        = 16000
            throughput  = 1000
            encrypted   = true
          }
        }
      }

      # Enhanced security for AI/ML workloads
      iam_role_additional_policies = {
        AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
        CloudWatchAgentServerPolicy  = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
      }
    }
  }

  # EKS Cluster security configuration
  cluster_security_group_id = module.vpc.default_security_group_id
  node_security_group_id   = module.vpc.default_security_group_id

  tags = {
    Name = "${var.project_name}-${var.environment}-eks"
  }
}

# EKS Add-ons
resource "aws_eks_addon" "cert_manager" {
  cluster_name = module.eks.cluster_name
  addon_name   = "cert-manager"
}

# IAM OIDC Provider for Kubernetes service accounts
resource "aws_iam_oidc_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  provider_name   = "oidc.eks.${var.aws_region}.amazonaws.com"
  url             = module.eks.cluster_oidc_issuer_url
}

# IAM Role for External DNS
module "external_dns_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"
  version = "~> 5.20"

  create_role                   = true
  role_name                    = "${var.project_name}-${var.environment}-external-dns"
  provider_url                 = aws_iam_oidc_provider.eks.url
  role_policy_arns             = [aws_iam_policy.external_dns.arn]
  oidc_fully_qualified_subjects = ["system:serviceaccount:kube-system:external-dns"]
}

resource "aws_iam_policy" "external_dns" {
  name        = "${var.project_name}-${var.environment}-external-dns"
  description = "Policy for External DNS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["route53:ChangeResourceRecordSets"]
        Resource = ["arn:aws:route53:::hostedzone/${var.route53_hosted_zone_id}"]
      },
      {
        Effect   = "Allow"
        Action   = ["route53:ListHostedZones", "route53:ListResourceRecordSets"]
        Resource = ["*"]
      }
    ]
  })
}

# IAM Role for Cert Manager
module "cert_manager_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"
  version = "~> 5.20"

  create_role                   = true
  role_name                    = "${var.project_name}-${var.environment}-cert-manager"
  provider_url                 = aws_iam_oidc_provider.eks.url
  role_policy_arns             = [aws_iam_policy.cert_manager.arn]
  oidc_fully_qualified_subjects = ["system:serviceaccount:cert-manager:cert-manager"]
}

resource "aws_iam_policy" "cert_manager" {
  name        = "${var.project_name}-${var.environment}-cert-manager"
  description = "Policy for Cert Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["route53:GetChange"]
        Resource = ["arn:aws:route53:::change/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["route53:ChangeResourceRecordSets", "route53:ListResourceRecordSets"]
        Resource = ["arn:aws:route53:::hostedzone/${var.route53_hosted_zone_id}"]
      },
      {
        Effect   = "Allow"
        Action   = ["route53:ListHostedZones"]
        Resource = ["*"]
      }
    ]
  })
}

# S3 Buckets for application storage
resource "aws_s3_bucket" "application_storage" {
  bucket = "${var.project_name}-${var.environment}-app-storage-${random_string.suffix.result}"

  tags = {
    Name        = "${var.project_name}-${var.environment}-application-storage"
    Environment  = var.environment
    Project      = var.project_name
    ManagedBy    = "Terraform"
    Purpose      = "Application Storage"
  }
}

resource "aws_s3_bucket_versioning" "application_storage" {
  bucket = aws_s3_bucket.application_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "application_storage" {
  bucket = aws_s3_bucket.application_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "application_storage" {
  bucket = aws_s3_bucket.application_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket for backups
resource "aws_s3_bucket" "backups" {
  bucket = "${var.project_name}-${var.environment}-backups-${random_string.suffix.result}"

  tags = {
    Name        = "${var.project_name}-${var.environment}-backups"
    Environment  = var.environment
    Project      = var.project_name
    ManagedBy    = "Terraform"
    Purpose      = "Database Backups"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "backup_lifecycle"
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
}

# RDS for PostgreSQL
module "rds" {
  source = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "${var.project_name}-${var.environment}-postgres"

  engine               = "postgres"
  engine_version       = "15.4"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = "db.m6i.large"

  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true

  db_name  = "quantumbeam"
  username = "quantumbeam"
  port     = 5432

  vpc_security_group_ids = [module.vpc.default_security_group_id]
  db_subnet_group_name   = module.vpc.database_subnet_group_name

  maintenance_window = "Mon:03:00-Mon:04:00"
  backup_window      = "04:00-05:00"

  backup_retention_period = 30
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.project_name}-${var.environment}-final-snapshot"

  deletion_protection = true

  # Enhanced monitoring
  monitoring_interval    = 60
  monitoring_role_arn    = aws_iam_role.rds_enhanced_monitoring.arn
  create_monitoring_role = false

  # Performance insights
  performance_insights_enabled          = true
  performance_insights_retention_period = "7"

  # Multi-AZ for high availability
  multi_az = true

  # Parameters
  parameters = [
    {
      name  = "max_connections"
      value = "200"
    },
    {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    },
    {
      name  = "log_statement"
      value = "all"
    },
    {
      name  = "log_min_duration_statement"
      value = "1000"
    }
  ]

  tags = {
    Name        = "${var.project_name}-${var.environment}-postgres"
    Environment  = var.environment
    Project      = var.project_name
    ManagedBy    = "Terraform"
    Purpose      = "Production Database"
  }
}

# IAM Role for RDS Enhanced Monitoring
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${var.project_name}-${var.environment}-rds-monitoring"

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

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-monitoring"
    Environment  = var.environment
    Project      = var.project_name
    ManagedBy    = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
  role       = aws_iam_role.rds_enhanced_monitoring.name
}

# ElastiCache for Redis
module "elasticache" {
  source = "terraform-aws-modules/elasticache/aws"
  version = "~> 1.0"

  name = "${var.project_name}-${var.environment}-redis"

  engine_version = "7.0"
  node_type      = "cache.r6g.large"

  num_cache_clusters         = 3
  automatic_failover_enabled = true
  multi_az_enabled           = true

  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = module.vpc.elasticache_subnet_group_name
  security_group_ids = [module.vpc.default_security_group_id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  log_delivery_configuration {
    destination      = module.vpc.cloudwatch_log_group_name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  maintenance_window = "sun:05:00-sun:06:00"
  snapshot_window    = "06:00-07:00"
  snapshot_retention_limit = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis"
    Environment  = var.environment
    Project      = var.project_name
    ManagedBy    = "Terraform"
    Purpose      = "Cache and Session Store"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application_logs" {
  name              = "/aws/eks/${var.project_name}-${var.environment}/containers"
  retention_in_days = 30

  tags = {
    Name        = "${var.project_name}-${var.environment}-application-logs"
    Environment  = var.environment
    Project      = var.project_name
    ManagedBy    = "Terraform"
  }
}

resource "aws_cloudwatch_log_group" "audit_logs" {
  name              = "/aws/eks/${var.project_name}-${var.environment}/audit"
  retention_in_days = 365

  tags = {
    Name        = "${var.project_name}-${var.environment}-audit-logs"
    Environment  = var.environment
    Project      = var.project_name
    ManagedBy    = "Terraform"
    Purpose      = "Audit and Compliance Logs"
  }
}

# CloudWatch Alarms for monitoring
module "cloudwatch_alarms" {
  source = "./modules/cloudwatch-alarms"

  cluster_name = module.eks.cluster_name
  environment  = var.environment
  project_name = var.project_name
}

# Outputs
output "cluster_name" {
  description = "EKS Cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS Cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "EKS Cluster certificate authority data"
  value       = module.eks.cluster_certificate_authority_data
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
}

output "redis_primary_endpoint" {
  description = "ElastiCache primary endpoint"
  value       = module.elasticache.primary_endpoint_address
}

output "application_storage_bucket" {
  description = "S3 bucket for application storage"
  value       = aws_s3_bucket.application_storage.id
}

output "backups_bucket" {
  description = "S3 bucket for backups"
  value       = aws_s3_bucket.backups.id
}