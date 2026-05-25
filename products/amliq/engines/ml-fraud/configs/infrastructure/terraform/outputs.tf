# Terraform outputs for QuantumBeam infrastructure

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

output "cluster_oidc_issuer_url" {
  description = "EKS Cluster OIDC issuer URL"
  value       = module.eks.cluster_oidc_issuer_url
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
}

output "database_port" {
  description = "RDS instance port"
  value       = module.rds.db_instance_port
}

output "database_name" {
  description = "RDS database name"
  value       = module.rds.db_instance_name
}

output "redis_primary_endpoint" {
  description = "ElastiCache primary endpoint"
  value       = module.elasticache.primary_endpoint_address
}

output "redis_port" {
  description = "ElastiCache port"
  value       = module.elasticache.port
}

output "application_storage_bucket" {
  description = "S3 bucket for application storage"
  value       = aws_s3_bucket.application_storage.id
}

output "application_storage_bucket_arn" {
  description = "S3 bucket ARN for application storage"
  value       = aws_s3_bucket.application_storage.arn
}

output "backups_bucket" {
  description = "S3 bucket for backups"
  value       = aws_s3_bucket.backups.id
}

output "backups_bucket_arn" {
  description = "S3 bucket ARN for backups"
  value       = aws_s3_bucket.backups.arn
}

output "eks_node_role_arn" {
  description = "EKS node role ARN"
  value       = module.eks.eks_managed_node_groups["general"].iam_role_arn
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group for application logs"
  value       = aws_cloudwatch_log_group.application_logs.name
}

output "cloudwatch_audit_log_group_name" {
  description = "CloudWatch log group for audit logs"
  value       = aws_cloudwatch_log_group.audit_logs.name
}

output "external_dns_role_arn" {
  description = "External DNS IAM role ARN"
  value       = module.external_dns_role.iam_role_arn
}

output "cert_manager_role_arn" {
  description = "Cert Manager IAM role ARN"
  value       = module.cert_manager_role.iam_role_arn
}

output "region" {
  description = "AWS region"
  value       = var.aws_region
}

# Security-related outputs
output "eks_cluster_security_group_id" {
  description = "EKS cluster security group ID"
  value       = module.eks.cluster_security_group_id
}

output "node_security_group_id" {
  description = "EKS node security group ID"
  value       = module.eks.node_security_group_id
}

# Kubernetes configuration
output "kubeconfig" {
  description = "Kubeconfig content"
  value       = module.eks.kubeconfig
  sensitive   = true
}

# Useful for local development and debugging
output "configure_kubectl" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --name ${module.eks.cluster_name} --region ${var.aws_region}"
}