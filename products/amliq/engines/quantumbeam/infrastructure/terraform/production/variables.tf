# Production Environment Variables

variable "aws_region" {
  description = "AWS region for production deployment"
  type        = string
  default     = "us-west-2"
}

variable "vpc_cidr" {
  description = "CIDR block for production VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "kubernetes_service_cidr" {
  description = "CIDR block for Kubernetes services"
  type        = string
  default     = "172.20.0.0/16"
}

variable "kubernetes_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.29"
}

variable "availability_zones" {
  description = "List of availability zones for production deployment"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

variable "eks_public_access_cidrs" {
  description = "CIDR blocks allowed to access EKS public endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_key_name" {
  description = "Name of SSH key pair for EC2 instances"
  type        = string
  default     = "quantumbeam-production-key"
}

variable "bastion_allowed_cidrs" {
  description = "CIDR blocks allowed to access bastion host"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# Node Group Configuration
variable "system_nodes_desired_size" {
  description = "Desired size of system node group"
  type        = number
  default     = 3
}

variable "system_nodes_max_size" {
  description = "Maximum size of system node group"
  type        = number
  default     = 6
}

variable "system_nodes_min_size" {
  description = "Minimum size of system node group"
  type        = number
  default     = 2
}

variable "system_nodes_instance_type" {
  description = "Instance type for system node group"
  type        = string
  default     = "m6i.xlarge"
}

variable "application_nodes_desired_size" {
  description = "Desired size of application node group"
  type        = number
  default     = 4
}

variable "application_nodes_max_size" {
  description = "Maximum size of application node group"
  type        = number
  default     = 10
}

variable "application_nodes_min_size" {
  description = "Minimum size of application node group"
  type        = number
  default     = 3
}

variable "application_nodes_instance_types" {
  description = "Instance types for application node group"
  type        = list(string)
  default     = ["m6i.2xlarge", "m6a.2xlarge", "m5.2xlarge"]
}

variable "ai_ml_nodes_desired_size" {
  description = "Desired size of AI/ML node group"
  type        = number
  default     = 2
}

variable "ai_ml_nodes_max_size" {
  description = "Maximum size of AI/ML node group"
  type        = number
  default     = 6
}

variable "ai_ml_nodes_min_size" {
  description = "Minimum size of AI/ML node group"
  type        = number
  default     = 1
}

variable "ai_ml_nodes_instance_types" {
  description = "Instance types for AI/ML node group"
  type        = list(string)
  default     = ["p4d.24xlarge", "p3.2xlarge", "g5.4xlarge"]
}

variable "spot_nodes_desired_size" {
  description = "Desired size of spot node group"
  type        = number
  default     = 2
}

variable "spot_nodes_max_size" {
  description = "Maximum size of spot node group"
  type        = number
  default     = 8
}

variable "spot_nodes_instance_types" {
  description = "Instance types for spot node group"
  type        = list(string)
  default     = ["c6i.4xlarge", "c5.4xlarge", "m6i.4xlarge", "r5.4xlarge"]
}

# Add-on Versions
variable "vpc_cni_version" {
  description = "VPC CNI add-on version"
  type        = string
  default     = "v1.16.0-eksbuild.1"
}

variable "coredns_version" {
  description = "CoreDNS add-on version"
  type        = string
  default     = "v1.11.1-eksbuild.4"
}

variable "kube_proxy_version" {
  description = "Kube-proxy add-on version"
  type        = string
  default     = "v1.29.0-eksbuild.2"
}

variable "ebs_csi_version" {
  description = "EBS CSI driver add-on version"
  type        = string
  default     = "v1.27.0-eksbuild.1"
}

# RDS Configuration
variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.2xlarge"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 500
}

variable "rds_max_allocated_storage" {
  description = "RDS maximum allocated storage in GB"
  type        = number
  default     = 2000
}

variable "rds_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "rds_backup_retention_period" {
  description = "RDS backup retention period in days"
  type        = number
  default     = 35
}

variable "rds_backup_window" {
  description = "Preferred RDS backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "rds_maintenance_window" {
  description = "Preferred RDS maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

# ElastiCache Configuration
variable "elasticache_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r6g.2xlarge"
}

variable "elasticache_num_cache_nodes" {
  description = "Number of ElastiCache nodes"
  type        = number
  default     = 3
}

variable "elasticache_parameter_group" {
  description = "ElastiCache parameter group"
  type        = string
  default     = "default.redis7"
}

# Application Configuration
variable "app_replicas" {
  description = "Number of application replicas"
  type        = number
  default     = 3
}

variable "fraud_detector_replicas" {
  description = "Number of fraud detector replicas"
  type        = number
  default     = 2
}

variable "ai_engine_replicas" {
  description = "Number of AI engine replicas"
  type        = number
  default     = 2
}

# Monitoring Configuration
variable "enable_cloudwatch_container_insights" {
  description = "Enable CloudWatch Container Insights"
  type        = bool
  default     = true
}

variable "enable_xray" {
  description = "Enable AWS X-Ray tracing"
  type        = bool
  default     = true
}

variable "enable_adot" {
  description = "Enable AWS Distro OpenTelemetry"
  type        = bool
  default     = true
}

# Alert Configuration
variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = "alerts@quantumbeam.io"
}

variable "pagerduty_service_key" {
  description = "PagerDuty service integration key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  sensitive   = true
  default     = ""
}

# Domain Configuration
variable "domain_name" {
  description = "Primary domain name for the application"
  type        = string
  default     = "quantumbeam.io"
}

variable "certificate_arn" {
  description = "ARN of SSL certificate for the domain"
  type        = string
  default     = ""
}

# Backup Configuration
variable "backup_retention_days" {
  description = "Default backup retention period in days"
  type        = number
  default     = 30
}

variable "enable_cross_region_backup" {
  description = "Enable cross-region backup replication"
  type        = bool
  default     = true
}

variable "backup_region" {
  description = "Secondary region for backup replication"
  type        = string
  default     = "us-east-1"
}

# Cost and Resource Management
variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "engineering"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name for resource tagging"
  type        = string
  default     = "quantumbeam"
}

variable "owner" {
  description = "Owner of the resources"
  type        = string
  default     = "devops-team"
}