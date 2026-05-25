# QuantumBeam Production Infrastructure Outputs

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_certificate_authority_data" {
  description = "EKS cluster certificate authority data"
  value       = module.eks.cluster_certificate_authority_data
}

output "eks_node_groups" {
  description = "EKS node groups"
  value       = module.eks.eks_managed_node_groups
}

output "rds_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.instance_endpoint
  sensitive   = true
}

output "rds_instance_id" {
  description = "RDS instance ID"
  value       = module.rds.instance_id
}

output "rds_instance_port" {
  description = "RDS instance port"
  value       = module.rds.instance_port
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint"
  value       = module.redis.primary_endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = module.redis.port
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "Application Load Balancer zone ID"
  value       = module.alb.alb_zone_id
}

output "alb_security_group_id" {
  description = "Application Load Balancer security group ID"
  value       = module.alb.alb_security_group_id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.dns.cloudfront_distribution_id
}

output "logs_bucket_name" {
  description = "S3 bucket name for logs"
  value       = module.storage.logs_bucket_name
}

output "backups_bucket_name" {
  description = "S3 bucket name for backups"
  value       = module.storage.backups_bucket_name
}

output "secrets_bucket_name" {
  description = "S3 bucket name for secrets"
  value       = module.storage.secrets_bucket_name
}

output "database_secret_arn" {
  description = "Database secret ARN"
  value       = aws_secretsmanager_secret.database.arn
  sensitive   = true
}

output "redis_secret_arn" {
  description = "Redis secret ARN"
  value       = aws_secretsmanager_secret.redis.arn
  sensitive   = true
}

output "jwt_secret_arn" {
  description = "JWT secret ARN"
  value       = aws_secretsmanager_secret.jwt.arn
  sensitive   = true
}

output "kms_key_arn" {
  description = "KMS key ARN for secrets"
  value       = aws_kms_key.secrets.arn
  sensitive   = true
}

output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "datadog_dashboard_url" {
  description = "Datadog dashboard URL"
  value       = module.monitoring.datadog_dashboard_url
}

output "terraform_state_bucket" {
  description = "Terraform state bucket name"
  value       = "quantumbeam-terraform-state"
}

output "terraform_locks_table" {
  description = "Terraform DynamoDB locks table name"
  value       = "quantumbeam-terraform-locks"
}