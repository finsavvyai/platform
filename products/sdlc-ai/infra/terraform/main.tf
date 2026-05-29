terraform {
  required_version = ">= 1.6.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
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
    vault = {
      source  = "hashicorp/vault"
      version = "~> 4.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
    template = {
      source  = "hashicorp/template"
      version = "~> 2.2"
    }
  }

  backend "s3" {
    bucket = "sdlc-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-west-1"
    encrypt = true
    dynamodb_table = "terraform-locks"
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/terraform-execution"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(local.tags, {
      ManagedBy = "Terraform"
      Environment = var.environment
    })
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name, "--region", var.aws_region]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name, "--region", var.aws_region]
    }
  }
}

provider "vault" {
  address = var.vault_address
  token   = var.vault_token
}

# Variables
variable "environment" {
  type        = string
  description = "Environment name"
  default     = "production"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-west-1"
}

variable "domain_name" {
  type        = string
  description = "Primary domain name"
  default     = "sdlc.ai"
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token"
  sensitive   = true
}

variable "vault_address" {
  type        = string
  description = "Vault server address"
  default     = "https://vault.sdlc.ai:8200"
}

variable "vault_token" {
  type        = string
  description = "Vault token"
  sensitive   = true
}

variable "github_repository" {
  type        = string
  description = "GitHub repository for CI/CD"
  default     = "github.com/SDLC-ai/platform"
}

# Local values
locals {
  name_prefix = "${var.environment}-sdlc"
  tags = {
    Project     = "SDLC.ai"
    Owner       = "Infrastructure"
    CostCenter  = "Engineering"
    Compliance  = "SOC2,HIPAA,GDPR"
  }

  vpc_cidr = "10.0.0.0/16"
  azs      = ["us-west-1a", "us-west-1b", "us-west-1c"]

  private_subnets = [
    "10.0.1.0/20",
    "10.0.2.0/20",
    "10.0.3.0/20"
  ]

  public_subnets = [
    "10.0.101.0/24",
    "10.0.102.0/24",
    "10.0.103.0/24"
  ]

  database_subnets = [
    "10.0.11.0/24",
    "10.0.12.0/24",
    "10.0.13.0/24"
  ]
}
