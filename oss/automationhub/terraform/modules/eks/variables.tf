# EKS Module Variables

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where EKS cluster will be created"
  type        = string
}

variable "private_subnets" {
  description = "List of private subnet IDs for EKS cluster"
  type        = list(string)
}

variable "public_subnets" {
  description = "List of public subnet IDs for EKS cluster"
  type        = list(string)
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
}

variable "ssh_key_name" {
  description = "SSH key name for EC2 instances"
  type        = string
  default     = null
}

variable "enabled_cluster_log_types" {
  description = "List of enabled cluster log types"
  type        = list(string)
  default = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]
}

variable "encryption_resources" {
  description = "List of resources to encrypt in the cluster"
  type        = list(string)
  default = [
    "secrets"
  ]
}

variable "public_access_cidrs" {
  description = "CIDR blocks that can access the EKS cluster public endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "cluster_endpoint_public_access_cidr" {
  description = "CIDR block for cluster endpoint access"
  type        = string
  default     = "0.0.0.0/0"
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "CIDR blocks that can access the cluster endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "node_groups" {
  description = "Map of node group definitions"
  type = map(object({
    desired_capacity    = number
    max_capacity        = number
    min_capacity        = number
    instance_type       = optional(string)
    instance_types      = optional(list(string))
    ami_type            = optional(string)
    disk_size           = optional(number)
    capacity_type       = optional(string)
    k8s_labels          = optional(map(string))
    taints              = optional(map(object({
      key    = string
      value  = string
      effect = string
    })))
    additional_tags     = optional(map(string))
  }))
}

variable "managed_node_group_defaults" {
  description = "Default settings for managed node groups"
  type = object({
    ami_type       = optional(string, "AL2_x86_64")
    disk_size      = optional(number, 50)
    instance_types = optional(list(string))
    k8s_labels     = optional(map(string))
  })
  default = {}
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}