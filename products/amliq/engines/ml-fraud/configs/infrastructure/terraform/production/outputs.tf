# Production Infrastructure Outputs

output "vpc_id" {
  description = "ID of the production VPC"
  value       = aws_vpc.production.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the production VPC"
  value       = aws_vpc.production.cidr_block
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.production.name
}

output "eks_cluster_endpoint" {
  description = "Endpoint of the EKS cluster"
  value       = aws_eks_cluster.production.endpoint
  sensitive   = true
}

output "eks_cluster_certificate_authority_data" {
  description = "Certificate authority data for the EKS cluster"
  value       = aws_eks_cluster.production.certificate_authority[0].data
  sensitive   = true
}

output "eks_cluster_security_group_id" {
  description = "Security group ID of the EKS cluster"
  value       = aws_security_group.eks_cluster.id
}

output "eks_node_groups" {
  description = "EKS node group information"
  value = {
    system = {
      id           = aws_eks_node_group.system_nodes.id
      node_role_arn = aws_eks_node_group.system_nodes.node_role_arn
      status       = aws_eks_node_group.system_nodes.status
    }
    application = {
      id           = aws_eks_node_group.application_nodes.id
      node_role_arn = aws_eks_node_group.application_nodes.node_role_arn
      status       = aws_eks_node_group.application_nodes.status
    }
    ai_ml = {
      id           = aws_eks_node_group.ai_ml_nodes.id
      node_role_arn = aws_eks_node_group.ai_ml_nodes.node_role_arn
      status       = aws_eks_node_group.ai_ml_nodes.status
    }
    spot = {
      id           = aws_eks_node_group.spot_nodes.id
      node_role_arn = aws_eks_node_group.spot_nodes.node_role_arn
      status       = aws_eks_node_group.spot_nodes.status
    }
  }
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = aws_subnet.database[*].id
}

output "availability_zones" {
  description = "List of availability zones"
  value       = var.availability_zones
}

output "kms_keys" {
  description = "KMS keys ARNs"
  value = {
    eks        = aws_kms_key.eks.arn
    secrets    = aws_kms_key.secrets.arn
    rds        = aws_kms_key.rds.arn
    elasticache = aws_kms_key.elasticache.arn
  }
  sensitive = true
}

output "s3_buckets" {
  description = "S3 bucket names"
  value = {
    cloudtrail_logs  = aws_s3_bucket.cloudtrail_logs.bucket
    config_logs      = aws_s3_bucket.config_logs.bucket
    waf_logs         = aws_s3_bucket.waf_logs.bucket
    application_data = aws_s3_bucket.application_data.bucket
    backups          = aws_s3_bucket.backups.bucket
  }
}

output "security_groups" {
  description = "Security group IDs"
  value = {
    eks_cluster   = aws_security_group.eks_cluster.id
    eks_nodes     = aws_security_group.eks_nodes.id
    bastion       = aws_security_group.bastion.id
    vpc_endpoints = aws_security_group.vpc_endpoints.id
  }
}

output "iam_roles" {
  description = "IAM role ARNs"
  value = {
    eks_cluster      = aws_iam_role.eks_cluster.arn
    eks_node         = aws_iam_role.eks_node.arn
    ebs_csi_driver   = aws_iam_role.ebs_csi_driver.arn
    config           = aws_iam_role.config.arn
  }
}

output "cloudtrail_id" {
  description = "CloudTrail ID"
  value       = aws_cloudtrail.production.id
}

output "config_recorder_name" {
  description = "AWS Config recorder name"
  value       = aws_config_configuration_recorder.production.name
}

output "guardduty_detector_id" {
  description = "GuardDuty detector ID"
  value       = aws_guardduty_detector.production.id
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = aws_wafv2_web_acl.production.arn
}

output "eks_oidc_provider_arn" {
  description = "EKS OIDC provider ARN"
  value       = aws_iam_openid_connect_provider.eks.arn
}

output "eks_addons" {
  description = "EKS add-ons information"
  value = {
    vpc_cni          = aws_eks_addon.vpc_cni.id
    coredns          = aws_eks_addon.coredns.id
    kube_proxy       = aws_eks_addon.kube_proxy.id
    aws_ebs_csi_driver = aws_eks_addon.aws_ebs_csi_driver.id
  }
}

output "bastion_sg_id" {
  description = "Bastion host security group ID"
  value       = aws_security_group.bastion.id
}

output "nat_gateway_ids" {
  description = "NAT Gateway IDs"
  value       = aws_nat_gateway.production[*].id
}

output "internet_gateway_id" {
  description = "Internet Gateway ID"
  value       = aws_internet_gateway.production.id
}

output "route_tables" {
  description = "Route table IDs"
  value = {
    public   = aws_route_table.public.id
    private  = aws_route_table.private[*].id
    database = aws_route_table.database[*].id
  }
}

output "vpc_endpoints" {
  description = "VPC endpoint IDs"
  value = {
    s3             = aws_vpc_endpoint.s3.id
    ecr_dkr         = aws_vpc_endpoint.ecr_dkr.id
    ecr_api         = aws_vpc_endpoint.ecr_api.id
    secretsmanager  = aws_vpc_endpoint.secretsmanager.id
    ssm             = aws_vpc_endpoint.ssm.id
    ssmmessages     = aws_vpc_endpoint.ssmmessages.id
    ec2             = aws_vpc_endpoint.ec2.id
    kms             = aws_vpc_endpoint.kms.id
  }
}

output "network_acls" {
  description = "Network ACL IDs"
  value = {
    public  = aws_network_acl.public.id
    private = aws_network_acl.private.id
  }
}

output "configure_kubectl" {
  description = "Command to configure kubectl for the EKS cluster"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${aws_eks_cluster.production.name}"
}

output "ssh_to_bastion_command" {
  description = "Command template to SSH to bastion host"
  value       = "ssh -i ${var.ssh_key_name}.pem ec2-user@<BASTION_IP>"
}

output "eks_cluster_security_group_rule" {
  description = "Security group rule for EKS cluster"
  value       = "Allow traffic from bastion to EKS API server on port 443"
}

# Database outputs (when RDS is created)
output "rds_cluster_endpoint" {
  description = "RDS cluster endpoint"
  value       = try(aws_rds_cluster.production.endpoint, "")
  sensitive   = true
}

output "rds_cluster_reader_endpoint" {
  description = "RDS cluster reader endpoint"
  value       = try(aws_rds_cluster.production.reader_endpoint, "")
  sensitive   = true
}

output "rds_cluster_port" {
  description = "RDS cluster port"
  value       = try(aws_rds_cluster.production.port, 5432)
}

output "rds_cluster_database_name" {
  description = "RDS cluster database name"
  value       = try(aws_rds_cluster.production.database_name, "")
}

output "rds_cluster_master_username" {
  description = "RDS cluster master username"
  value       = try(aws_rds_cluster.production.master_username, "")
  sensitive   = true
}

# ElastiCache outputs (when ElastiCache is created)
output "elasticache_cluster_endpoint" {
  description = "ElastiCache cluster endpoint"
  value       = try(aws_elasticache_replication_group.production.primary_endpoint_address, "")
}

output "elasticache_cluster_port" {
  description = "ElastiCache cluster port"
  value       = try(aws_elasticache_replication_group.production.port, 6379)
}

output "elasticache_cluster_auth_token" {
  description = "ElastiCache cluster auth token"
  value       = try(random_password.elasticache_auth.result, "")
  sensitive   = true
}

# ALB outputs (when ALB is created)
output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = try(aws_lb.production.dns_name, "")
}

output "alb_zone_id" {
  description = "Application Load Balancer zone ID"
  value       = try(aws_lb.production.zone_id, "")
}

output "alb_target_group_arns" {
  description = "Application Load Balancer target group ARNs"
  value       = try(aws_lb_target_group.production[*].arn, [])
}

# Monitoring outputs
output "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = try(aws_cloudwatch_log_group.production.arn, "")
}

output "prometheus_workspace_id" {
  description = "Prometheus workspace ID"
  value       = try(aws_prometheus_workspace.production.id, "")
}

output "grafana_endpoint" {
  description = "Grafana endpoint URL"
  value       = try(aws_grafana_workspace.production.endpoint, "")
  sensitive   = true
}

# Backup outputs
output "backup_vault_name" {
  description = "Backup vault name"
  value       = try(aws_backup_vault.production.name, "")
}

output "backup_plan_id" {
  description = "Backup plan ID"
  value       = try(aws_backup_plan.production.id, "")
}