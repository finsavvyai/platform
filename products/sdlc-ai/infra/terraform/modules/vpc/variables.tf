variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  default     = "10.0.0.0/16"
}

variable "public_subnets" {
  type        = list(string)
  description = "CIDR blocks for public subnets"
}

variable "private_subnets" {
  type        = list(string)
  description = "CIDR blocks for private subnets"
}

variable "database_subnets" {
  type        = list(string)
  description = "CIDR blocks for database subnets"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "cluster_name" {
  type        = string
  description = "EKS cluster name"
}

variable "enable_flow_logs" {
  type        = bool
  description = "Enable VPC flow logs"
  default     = true
}

variable "log_retention_days" {
  type        = number
  description = "Log retention in days"
  default     = 90
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to resources"
  default     = {}
}
