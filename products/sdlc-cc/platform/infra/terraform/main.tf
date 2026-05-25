terraform {
  required_version = ">= 1.5.0"
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
    bucket         = "sdlc-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-west-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
    role_arn       = "arn:aws:iam::ACCOUNT_ID:role/terraform-execution"
  }
}

# Providers + variables are declared in versions.tf / variables.tf.

# Local values
locals {
  name_prefix = "${var.environment}-sdlc"
  tags = {
    Project    = "SDLC.ai"
    Owner      = "Infrastructure"
    CostCenter = "Engineering"
    Compliance = "SOC2,HIPAA,GDPR"
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
