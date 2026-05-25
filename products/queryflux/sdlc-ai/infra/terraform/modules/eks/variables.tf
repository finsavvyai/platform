variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "cluster_name" {
  type        = string
  description = "EKS cluster name"
}

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version"
  default     = "1.29"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "List of public subnet IDs"
}

variable "desired_size" {
  type        = number
  description = "Desired number of worker nodes"
  default     = 3
}

variable "max_size" {
  type        = number
  description = "Maximum number of worker nodes"
  default     = 6
}

variable "min_size" {
  type        = number
  description = "Minimum number of worker nodes"
  default     = 3
}

variable "instance_types" {
  type        = list(string)
  description = "EC2 instance types for worker nodes"
  default     = ["m6.large", "m6.xlarge"]
}

variable "disk_size" {
  type        = number
  description = "Disk size in GiB for worker nodes"
  default     = 50
}

variable "ssh_key_name" {
  type        = string
  description = "SSH key name for EC2 instances"
  default     = ""
}

variable "kms_key_arn" {
  type        = string
  description = "KMS key ARN for envelope encryption"
}

variable "enabled_cluster_log_types" {
  type        = list(string)
  description = "List of desired cluster log types"
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
}

variable "bastion_role_arn" {
  type        = string
  description = "IAM role ARN for bastion host"
}

variable "map_users" {
  type        = list(any)
  description = "List of IAM users to map to Kubernetes users"
  default     = []
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "vpc_cni_version" {
  type        = string
  description = "VPC CNI addon version"
  default     = "v1.12.0-eksbuild.1"
}

variable "coredns_version" {
  type        = string
  description = "CoreDNS addon version"
  default     = "v1.10.1-eksbuild.9"
}

variable "kube_proxy_version" {
  type        = string
  description = "Kube-proxy addon version"
  default     = "v1.28.2-eksbuild.1"
}

variable "ebs_csi_version" {
  type        = string
  description = "EBS CSI driver addon version"
  default     = "v1.24.0-eksbuild.1"
}

variable "cluster_autoscaler_version" {
  type        = string
  description = "Cluster Autoscaler Helm chart version"
  default     = "9.29.0"
}

variable "metrics_server_version" {
  type        = string
  description = "Metrics Server Helm chart version"
  default     = "3.11.0"
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to resources"
  default     = {}
}
