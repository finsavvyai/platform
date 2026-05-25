output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "EKS cluster certificate authority data"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

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

output "database_subnet_ids" {
  description = "Database subnet IDs"
  value       = module.vpc.database_subnets
}

output "worker_node_role_arn" {
  description = "Worker node IAM role ARN"
  value       = module.eks.worker_iam_role_arn
}

output "worker_node_instance_types" {
  description = "Worker node instance types"
  value       = var.worker_instance_types
}

output "cloudflare_zone_id" {
  description = "Cloudflare zone ID"
  value       = data.cloudflare_zone.main.id
}

output "load_balancer_dns_name" {
  description = "Load balancer DNS name"
  value       = module.load_balancer.load_balancer_dns_name
}

output "load_balancer_zone_id" {
  description = "Load balancer zone ID"
  value       = module.load_balancer.load_balancer_zone_id
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = module.api_gateway.api_gateway_url
}

output "cloudflare_workers_kv_namespace_id" {
  description = "Cloudflare Workers KV namespace ID"
  value       = module.cloudflare_workers.kv_namespace_id
}

output "cloudflare_r2_bucket_name" {
  description = "Cloudflare R2 bucket name"
  value       = module.cloudflare_storage.r2_bucket_name
}

output "cloudflare_vectorize_index_id" {
  description = "Cloudflare Vectorize index ID"
  value       = module.cloudflare_vectorize.index_id
}

output "cloudflare_queue_id" {
  description = "Cloudflare Queue ID"
  value       = module.cloudflare_queue.queue_id
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = module.database.database_endpoint
  sensitive   = true
}

output "database_port" {
  description = "RDS database port"
  value       = module.database.database_port
}

output "database_name" {
  description = "RDS database name"
  value       = module.database.database_name
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.redis.redis_endpoint
  sensitive   = true
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = module.redis.redis_port
}

output "vault_endpoint" {
  description = "Vault endpoint"
  value       = module.vault.vault_endpoint
}

output "vault_unseal_keys_b64" {
  description = "Vault unseal keys (base64 encoded)"
  value       = module.vault.unseal_keys_b64
  sensitive   = true
}

output "vault_root_token" {
  description = "Vault root token"
  value       = module.vault.root_token
  sensitive   = true
}

output "prometheus_endpoint" {
  description = "Prometheus endpoint"
  value       = module.monitoring.prometheus_endpoint
}

output "grafana_endpoint" {
  description = "Grafana endpoint"
  value       = module.monitoring.grafana_endpoint
}

output "elasticsearch_endpoint" {
  description = "Elasticsearch endpoint"
  value       = module.logging.elasticsearch_endpoint
}

output "kibana_endpoint" {
  description = "Kibana endpoint"
  value       = module.logging.kibana_endpoint
}

output "ci_cd_pipeline_role_arn" {
  description = "CI/CD pipeline IAM role ARN"
  value       = module.ci_cd.pipeline_role_arn
}

output "artifact_bucket_name" {
  description = "S3 bucket for CI/CD artifacts"
  value       = module.ci_cd.artifact_bucket_name
}

output "codebuild_project_name" {
  description = "CodeBuild project name"
  value       = module.ci_cd.codebuild_project_name
}

output "codepipeline_name" {
  description = "CodePipeline name"
  value       = module.ci_cd.codepipeline_name
}

output "sns_topic_arn" {
  description = "SNS topic ARN for notifications"
  value       = module.notifications.sns_topic_arn
}

output "sns_topic_name" {
  description = "SNS topic name"
  value       = module.notifications.sns_topic_name
}

output "security_group_id" {
  description = "Main security group ID"
  value       = module.security.security_group_id
}

output "nat_gateway_ids" {
  description = "NAT Gateway IDs"
  value       = module.vpc.natgw_ids
}

output "internet_gateway_id" {
  description = "Internet Gateway ID"
  value       = module.vpc.igw_id
}

output "route_table_ids" {
  description = "Route table IDs"
  value       = module.vpc.private_route_table_ids
}

output "ebs_volume_ids" {
  description = "EBS volume IDs for persistent storage"
  value       = module.storage.ebs_volume_ids
}

output "efs_filesystem_id" {
  description = "EFS filesystem ID"
  value       = module.storage.efs_filesystem_id
}

output "backup_vault_name" {
  description = "AWS Backup vault name"
  value       = module.backup.backup_vault_name
}

output "backup_plan_id" {
  description = "AWS Backup plan ID"
  value       = module.backup.backup_plan_id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cdn.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cdn.cloudfront_domain_name
}

output "waf_web_acl_id" {
  description = "WAF Web ACL ID"
  value       = module.security.waf_web_acl_id
}

output "shield_protection_id" {
  description = "Shield protection ID"
  value       = module.security.shield_protection_id
}

output "certificate_arn" {
  description = "SSL certificate ARN"
  value       = module.security.certificate_arn
}

output "kms_key_id" {
  description = "KMS key ID"
  value       = module.security.kms_key_id
}

output "parameter_store_arn" {
  description = "Systems Manager Parameter Store ARN"
  value       = module.secrets.parameter_store_arn
}

output "secrets_manager_arn" {
  description = "Secrets Manager ARN"
  value       = module.secrets.secrets_manager_arn
}

output "bastion_host_public_ip" {
  description = "Bastion host public IP"
  value       = module.bastion.bastion_public_ip
}

output "vpn_endpoint_id" {
  description = "VPN endpoint ID"
  value       = module.vpn.vpn_endpoint_id
}

output "cloudtrail_s3_bucket" {
  description = "CloudTrail S3 bucket"
  value       = module.audit.cloudtrail_s3_bucket
}

output "config_s3_bucket" {
  description = "Config S3 bucket"
  value       = module.audit.config_s3_bucket
}

output "guardduty_detector_id" {
  description = "GuardDuty detector ID"
  value       = module.audit.guardduty_detector_id
}

output "security_hub_arn" {
  description = "Security Hub ARN"
  value       = module.audit.security_hub_arn
}

output "macie_account_id" {
  description = "Macie account ID"
  value       = module.audit.macie_account_id
}

output "inspector_assessment_template_arn" {
  description = "Inspector assessment template ARN"
  value       = module.audit.inspector_assessment_template_arn
}
