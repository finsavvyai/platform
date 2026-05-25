# QuantumBeam Production Infrastructure
# Terraform configuration for complete production environment

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
    kubectl = {
      source  = "alekc/kubectl"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.30"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
  }

  # Backend configuration for state management
  backend "s3" {
    bucket         = "quantumbeam-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "quantumbeam-terraform-locks"
    role_arn       = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/terraform-execution-role"
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
      Owner       = "platform-team@quantumbeam.io"
      CostCenter  = "engineering"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}

provider "kubectl" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  load_config_file       = false

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "datadog" {
  api_key  = var.datadog_api_key
  app_key  = var.datadog_app_key
  site     = "datadoghq.com"
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com", "eks.amazonaws.com"]
    }
  }
}

# Local values
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "platform-team@quantumbeam.io"
  }

  vpc_cidr = "10.0.0.0/16"

  azs = slice(data.aws_availability_zones.available.names, 0, 3)

  private_subnets = [
    for i in range(length(local.azs)) :
    cidrsubnet(local.vpc_cidr, 8, i)
  ]

  public_subnets = [
    for i in range(length(local.azs)) :
    cidrsubnet(local.vpc_cidr, 8, i + 10)
  ]

  database_subnets = [
    for i in range(length(local.azs)) :
    cidrsubnet(local.vpc_cidr, 8, i + 20)
  ]
}

# Random resources
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "random_password" "database_password" {
  length  = 32
  special = true
}

resource "random_password" "redis_password" {
  length  = 32
  special = true
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

# VPC Module
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.5.1"

  name = local.name_prefix
  cidr = local.vpc_cidr

  azs                  = local.azs
  private_subnets      = local.private_subnets
  public_subnets       = local.public_subnets
  database_subnets     = local.database_subnets

  enable_nat_gateway     = true
  single_nat_gateway     = false
  one_nat_gateway_per_az = true

  enable_dns_hostnames = true
  enable_dns_support   = true

  # Database subnet configuration
  create_database_subnet_group = true
  create_database_subnet_route_table = true

  # VPC flow logs
  enable_flow_log                      = true
  flow_log_destination_type            = "cloud-watch-logs"
  flow_log_log_group_name              = aws_cloudwatch_log_group.vpc_flow_logs.name
  flow_log_traffic_type                = "ALL"
  flow_log_cloudwatch_log_group_retention = 30

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

# Security Groups
module "security_groups" {
  source = "./modules/security-groups"

  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id
  common_tags = local.common_tags
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  version = "19.15.3"

  cluster_name    = local.name_prefix
  cluster_version = var.kubernetes_version

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true
  cluster_endpoint_private_access = true

  managed_node_groups = {
    quantumbeam_nodes = {
      name                   = "quantumbeam-nodes"
      instance_types         = ["m6i.large", "m6i.xlarge"]
      vpc_security_group_ids = [module.security_groups.eks_nodes_sg_id]

      desired_size = 3
      min_size     = 2
      max_size     = 10

      capacity_type = "ON_DEMAND"

      iam_role_additional_policies = {
        additional = aws_iam_policy.eks_additional.arn
      }

      tags = merge(local.common_tags, {
        Role = "worker"
        Type = "general-purpose"
      })
    }

    system_nodes = {
      name                   = "system-nodes"
      instance_types         = ["t4g.medium"]
      vpc_security_group_ids = [module.security_groups.eks_nodes_sg_id]

      desired_size = 2
      min_size     = 1
      max_size     = 3

      capacity_type = "SPOT"

      taints = {
        dedicated = {
          key    = "dedicated"
          value  = "system"
          effect = "NO_SCHEDULE"
        }
      }

      tags = merge(local.common_tags, {
        Role = "system"
        Type = "spot"
      })
    }
  }

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

  iam_role_additional_policies = {
    additional = aws_iam_policy.eks_cluster_additional.arn
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks"
  })
}

# RDS Database
module "rds" {
  source = "./modules/rds"

  name_prefix     = local.name_prefix
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.database_subnets
  security_groups = [module.security_groups.rds_sg_id]

  database_name = var.database_name
  username      = var.database_username
  password      = random_password.database_password.result

  instance_class = "db.m6i.large"
  engine         = "postgresql"
  engine_version = "15.4"

  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  storage_type      = "io1"
  allocated_storage = 1000
  iops              = 3000

  common_tags = local.common_tags
}

# ElastiCache Redis
module "redis" {
  source = "./modules/redis"

  name_prefix     = local.name_prefix
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.database_subnets
  security_groups = [module.security_groups.redis_sg_id]

  node_type            = "cache.m6g.large"
  num_cache_nodes      = 3
  automatic_failover   = true
  multi_az_enabled     = true
  at_rest_encryption   = true
  transit_encryption   = true
  auth_token           = random_password.redis_password.result

  common_tags = local.common_tags
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  name_prefix     = local.name_prefix
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.public_subnets
  security_groups = [module.security_groups.alb_sg_id]

  certificate_arn = aws_acm_certificate.main.arn

  common_tags = local.common_tags
}

# Cloudflare DNS
module "dns" {
  source = "./modules/dns"

  name      = var.project_name
  domain    = var.domain
  zone_id   = var.cloudflare_zone_id

  alb_dns_name = module.alb.alb_dns_name
  alb_zone_id = module.alb.alb_zone_id

  common_tags = local.common_tags
}

# Monitoring and Observability
module "monitoring" {
  source = "./modules/monitoring"

  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id

  datadog_api_key = var.datadog_api_key

  common_tags = local.common_tags
}

# S3 Buckets
module "storage" {
  source = "./modules/storage"

  name_prefix = local.name_prefix

  common_tags = local.common_tags
}

# Secrets Manager
resource "aws_secretsmanager_secret" "database" {
  name = "${local.name_prefix}/database"

  description = "QuantumBeam database credentials"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id

  secret_string = jsonencode({
    host     = module.rds.instance_endpoint
    port     = module.rds.instance_port
    name     = var.database_name
    username = var.database_username
    password = random_password.database_password.result
  })
}

resource "aws_secretsmanager_secret" "redis" {
  name = "${local.name_prefix}/redis"

  description = "QuantumBeam Redis credentials"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id = aws_secretsmanager_secret.redis.id

  secret_string = jsonencode({
    host       = module.redis.primary_endpoint
    port       = module.redis.port
    auth_token = random_password.redis_password.result
  })
}

resource "aws_secretsmanager_secret" "jwt" {
  name = "${local.name_prefix}/jwt"

  description = "QuantumBeam JWT secret"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id = aws_secretsmanager_secret.jwt.id

  secret_string = jsonencode({
    secret = random_password.jwt_secret.result
  })
}

# ACM Certificate
resource "aws_acm_certificate" "main" {
  domain_name       = var.domain
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain}",
    "api.${var.domain}",
    "app.${var.domain}"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-certificate"
  })
}

resource "aws_route53_record" "certificate_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

# IAM Policies
resource "aws_iam_policy" "eks_additional" {
  name        = "${local.name_prefix}-eks-additional"
  description = "Additional permissions for EKS nodes"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:DescribeImages",
          "ecr:ListImages",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.database.arn,
          aws_secretsmanager_secret.redis.arn,
          aws_secretsmanager_secret.jwt.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = [aws_kms_key.secrets.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          module.storage.logs_bucket_arn,
          "${module.storage.logs_bucket_arn}/*",
          module.storage.backups_bucket_arn,
          "${module.storage.backups_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_policy" "eks_cluster_additional" {
  name        = "${local.name_prefix}-eks-cluster-additional"
  description = "Additional permissions for EKS cluster"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeSubnets",
          "ec2:DescribeVpcs",
          "ec2:DescribeVolumes",
          "autoscaling:DescribeAutoScalingGroups"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

# KMS Key for secrets
resource "aws_kms_key" "secrets" {
  description             = "${local.name_prefix} secrets encryption key"
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
        Sid    = "Allow access for Key Administrators"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/terraform-execution-role",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/platform-admin"
          ]
        }
        Action = [
          "kms:Create*",
          "kms:Describe*",
          "kms:Enable*",
          "kms:List*",
          "kms:Put*",
          "kms:Update*",
          "kms:Revoke*",
          "kms:Disable*",
          "kms:Get*",
          "kms:Delete*",
          "kms:TagResource",
          "kms:UntagResource",
          "kms:ScheduleKeyDeletion",
          "kms:CancelKeyDeletion"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow use of the key"
        Effect = "Allow"
        Principal = {
          AWS = [
            module.eks.cluster_iam_role_arn,
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/terraform-execution-role"
          ]
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
    Name = "${local.name_prefix}-secrets-key"
  })
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${local.name_prefix}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/flow-logs/${local.name_prefix}"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Type = "vpc-flow-logs"
  })
}

resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/eks/${local.name_prefix}/application"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Type = "application-logs"
  })
}

resource "aws_cloudwatch_log_group" "system" {
  name              = "/aws/eks/${local.name_prefix}/system"
  retention_in_days = 14

  tags = merge(local.common_tags, {
    Type = "system-logs"
  })
}

# CloudWatch Dashboards
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/EKS", "cluster_cpu_utilization", "ClusterName", module.eks.cluster_name],
            [".", "cluster_memory_utilization", ".", "."],
            [".", "cluster_running_pod_count", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "EKS Cluster Metrics"
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", module.rds.instance_id],
            [".", "DatabaseConnections", ".", "."],
            [".", "FreeStorageSpace", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "RDS Database Metrics"
        }
      }
    ]
  })
}

# Cost monitoring
resource "aws_budgets_budget" "monthly" {
  name              = "${local.name_prefix}-monthly-budget"
  budget_type       = "COST"
  limit_amount      = var.monthly_budget_limit
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2024-01-01_00:00"

  cost_filter {
    name = "Service"
    values = [
      "Amazon Elastic Compute Cloud - Compute",
      "Amazon EC2 Container Service",
      "Amazon Relational Database Service",
      "Amazon ElastiCache",
      "Amazon CloudWatch"
    ]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE_OF_BUDGET"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["platform-team@quantumbeam.io"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE_OF_BUDGET"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["platform-team@quantumbeam.io", "finance@quantumbeam.io"]
  }

  tags = local.common_tags
}