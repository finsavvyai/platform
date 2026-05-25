# Terraform version constraints
terraform {
  required_version = ">= 1.6.0"
}

# Provider version constraints
provider "cloudflare" {
  version = "~> 4.0"
}

provider "aws" {
  version = "~> 5.0"
}

provider "kubernetes" {
  version = "~> 2.23"
}

provider "helm" {
  version = "~> 2.11"
}

provider "kubectl" {
  version = "~> 2.0"
}

provider "vault" {
  version = "~> 4.0"
}

provider "random" {
  version = "~> 3.5"
}

provider "null" {
  version = "~> 3.2"
}

provider "template" {
  version = "~> 2.2"
}
