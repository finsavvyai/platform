# UPM.Plus AutomationHub - Terraform Configuration
# AWS Infrastructure as Code for Production Deployment

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }

    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }

    kubectl = {
      source  = "alekc/kubectl"
      version = "~> 2.0"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket = var.terraform_backend_bucket
    key    = "upm-plus-automationhub/terraform.tfstate"
    region = var.aws_region

    dynamodb_table = var.terraform_lock_table
    encrypt        = true
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "UPM.Plus AutomationHub"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = var.owner_email
    }
  }
}

# Configure Kubernetes Provider
data "aws_eks_cluster" "cluster" {
  name = module.eks.cluster_name
}

data "aws_eks_cluster_auth" "auth" {
  name = module.eks.cluster_name
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.auth.token
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.cluster.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.auth.token
  }
}

provider "kubectl" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.auth.token
  load_config_file       = false
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  environment = var.environment
  region      = var.aws_region

  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs

  enable_nat_gateway = true
  enable_vpn_gateway = var.enable_vpn_gateway

  tags = var.tags
}

# EKS Cluster Module
module "eks" {
  source = "./modules/eks"

  environment = var.environment

  vpc_id          = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnets

  cluster_name    = var.eks_cluster_name
  cluster_version = var.eks_cluster_version

  node_groups = {
    general = {
      desired_capacity = var.general_node_count
      max_capacity     = var.general_node_max_count
      min_capacity     = var.general_node_min_count
      instance_type    = var.general_node_instance_type

      k8s_labels = {
        role = "general"
      }

      additional_tags = {
        Name = "${var.environment}-upm-plus-general-nodes"
      }
    }

    system = {
      desired_capacity = var.system_node_count
      max_capacity     = var.system_node_max_count
      min_capacity     = var.system_node_min_count
      instance_type    = var.system_node_instance_type

      k8s_labels = {
        role = "system"
      }

      taints = {
        dedicated = {
          key    = "dedicated"
          value  = "system"
          effect = "NO_SCHEDULE"
        }
      }

      additional_tags = {
        Name = "${var.environment}-upm-plus-system-nodes"
      }
    }
  }

  managed_node_group_defaults = {
    ami_type       = "AL2_x86_64"
    disk_size      = 50
    instance_types = [var.general_node_instance_type]

    tags = {
      "k8s.io/cluster-autoscaler/enabled" = "true"
      "k8s.io/cluster-autoscaler/${var.eks_cluster_name}" = "true"
    }
  }

  tags = var.tags
}

# RDS Module
module "rds" {
  source = "./modules/rds"

  environment = var.environment

  vpc_id          = module.vpc.vpc_id
  database_subnets = module.vpc.database_subnets

  database_name = var.database_name
  username      = var.database_username
  password      = var.database_password

  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  engine            = var.db_engine
  engine_version    = var.db_engine_version

  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window

  security_group_rules = {
    ingress = {
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      description = "PostgreSQL access from EKS"
      cidr_blocks = [module.vpc.vpc_cidr]
    }
  }

  tags = var.tags
}

# ElastiCache (Redis) Module
module "elasticache" {
  source = "./modules/elasticache"

  environment = var.environment

  vpc_id          = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnets

  replication_group_id = "${var.environment}-upm-plus-redis"
  node_type           = var.redis_node_type
  port                = 6379
  parameter_group_name = "default.redis7"

  num_cache_clusters = 2

  auth_token = var.redis_auth_token

  security_group_rules = {
    ingress = {
      from_port   = 6379
      to_port     = 6379
      protocol    = "tcp"
      description = "Redis access from EKS"
      cidr_blocks = [module.vpc.vpc_cidr]
    }
  }

  tags = var.tags
}

# S3 Buckets Module
module "s3" {
  source = "./modules/s3"

  environment = var.environment

  buckets = {
    "upm-plus-artifacts-${var.environment}" = {
      description = "Build artifacts and deployments"
      versioning  = true
      encryption  = true

      lifecycle_rules = [
        {
          id      = "cleanup_old_versions"
          enabled = true

          noncurrent_version_transitions = [
            {
              noncurrent_days = 30
              storage_class   = "STANDARD_IA"
            },
            {
              noncurrent_days = 60
              storage_class   = "GLACIER"
            },
            {
              noncurrent_days = 90
              storage_class   = "DEEP_ARCHIVE"
            }
          ]
        }
      ]
    }

    "upm-plus-logs-${var.environment}" = {
      description = "Application and system logs"
      versioning  = true
      encryption  = true

      lifecycle_rules = [
        {
          id      = "log_retention"
          enabled = true

          transitions = [
            {
              days          = 30
              storage_class = "STANDARD_IA"
            },
            {
              days          = 60
              storage_class = "GLACIER"
            },
            {
              days          = 90
              storage_class = "DEEP_ARCHIVE"
            }
          ]

          expiration = {
            days = 365
          }
        }
      ]
    }

    "upm-plus-backups-${var.environment}" = {
      description = "Database and file backups"
      versioning  = true
      encryption  = true

      lifecycle_rules = [
        {
          id      = "backup_retention"
          enabled = true

          transitions = [
            {
              days          = 7
              storage_class = "STANDARD_IA"
            },
            {
              days          = 30
              storage_class = "GLACIER"
            },
            {
              days          = 90
              storage_class = "DEEP_ARCHIVE"
            }
          ]

          expiration = {
            days = 2555  # 7 years
          }
        }
      ]
    }
  }

  tags = var.tags
}

# CloudFront and Route53 Module
module "cdn" {
  source = "./modules/cdn"

  environment = var.environment

  domain_name = var.domain_name
  zone_id     = var.route53_zone_id

  # S3 origin for static assets
  s3_bucket_domain_name = module.s3.buckets["upm-plus-artifacts-${var.environment}"].bucket_regional_domain_name

  # API origin
  api_origin_domain = module.eks.cluster_endpoint

  tags = var.tags
}

# CloudWatch Alarms and Monitoring
module "monitoring" {
  source = "./modules/monitoring"

  environment = var.environment

  eks_cluster_name = module.eks.cluster_name
  rds_instance_id = module.rds.db_instance_id

  # SNS topics for alerts
  sns_email_endpoints = var.alert_email_endpoints
  sns_slack_webhook   = var.alert_slack_webhook

  tags = var.tags
}

# Security Groups and NACLs
module "security" {
  source = "./modules/security"

  environment = var.environment

  vpc_id = module.vpc.vpc_id

  # Security group rules for different tiers
  alb_security_group_rules = {
    http = {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      description = "HTTP traffic"
      cidr_blocks = ["0.0.0.0/0"]
    }

    https = {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      description = "HTTPS traffic"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  eks_security_group_rules = {
    https = {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      description = "EKS API access"
      cidr_blocks = [var.vpc_cidr]
    }
  }

  tags = var.tags
}

# Kubernetes Add-ons
resource "helm_release" "aws_load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  namespace  = "kube-system"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = "1.5.5"

  set {
    name  = "clusterName"
    value = module.eks.cluster_name
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.eks.lb_controller_role_arn
  }
}

resource "helm_release" "cluster_autoscaler" {
  name       = "cluster-autoscaler"
  namespace  = "kube-system"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  version    = "9.29.0"

  set {
    name  = "autoDiscovery.clusterName"
    value = module.eks.cluster_name
  }

  set {
    name  = "awsRegion"
    value = var.aws_region
  }

  set {
    name  = "rbac.create"
    value = "true"
  }

  set {
    name  = "rbac.serviceAccount.create"
    value = "true"
  }

  set {
    name  = "rbac.serviceAccount.name"
    value = "cluster-autoscaler"
  }

  set {
    name  = "rbac.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.eks.cluster_autoscaler_role_arn
  }
}

resource "helm_release" "external_dns" {
  name       = "external-dns"
  namespace  = "kube-system"
  repository = "https://kubernetes-sigs.github.io/external-dns/"
  chart      = "external-dns"
  version    = "1.13.0"

  set {
    name  = "provider"
    value = "aws"
  }

  set {
    name  = "aws.zoneType"
    value = "public"
  }

  set {
    name  = "rbac.create"
    value = "true"
  }

  set {
    name  = "policy"
    value = "upsert"
  }

  set {
    name  = "domainFilters[0]"
    value = var.domain_name
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.eks.external_dns_role_arn
  }
}

# Outputs for downstream modules
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_name" {
  description = "EKS Cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS Cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "database_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_instance_endpoint
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.elasticache.redis_primary_endpoint
}

output "bucket_names" {
  description = "S3 bucket names"
  value       = module.s3.bucket_names
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cdn.cloudfront_domain_name
}