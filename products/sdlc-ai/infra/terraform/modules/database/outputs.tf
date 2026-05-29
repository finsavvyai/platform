output "database_endpoint" {
  description = "RDS primary instance endpoint"
  value       = aws_db_instance.primary.endpoint
}

output "database_hosted_zone_id" {
  description = "RDS primary instance hosted zone ID"
  value       = aws_db_instance.primary.hosted_zone_id
}

output "database_port" {
  description = "RDS database port"
  value       = aws_db_instance.primary.port
}

output "database_name" {
  description = "RDS database name"
  value       = aws_db_instance.primary.db_name
}

output "database_username" {
  description = "RDS database username"
  value       = aws_db_instance.primary.username
}

output "database_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.primary.id
}

output "database_instance_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.primary.arn
}

output "database_instance_class" {
  description = "RDS instance class"
  value       = aws_db_instance.primary.instance_class
}

output "database_instance_status" {
  description = "RDS instance status"
  value       = aws_db_instance.primary.status
}

output "database_allocated_storage" {
  description = "RDS allocated storage"
  value       = aws_db_instance.primary.allocated_storage
}

output "database_engine" {
  description = "RDS database engine"
  value       = aws_db_instance.primary.engine
}

output "database_engine_version" {
  description = "RDS database engine version"
  value       = aws_db_instance.primary.engine_version
}

output "database_security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.database.id
}

output "database_subnet_group_name" {
  description = "RDS subnet group name"
  value       = aws_db_subnet_group.database.name
}

output "database_parameter_group_name" {
  description = "RDS parameter group name"
  value       = aws_db_parameter_group.postgres.name
}

output "database_option_group_name" {
  description = "RDS option group name"
  value       = aws_db_option_group.postgres.name
}

output "read_replica_endpoint" {
  description = "RDS read replica endpoint"
  value       = var.enable_read_replica ? aws_db_instance.read_replica[0].endpoint : null
}

output "read_replica_instance_id" {
  description = "RDS read replica instance ID"
  value       = var.enable_read_replica ? aws_db_instance.read_replica[0].id : null
}

output "read_replica_instance_arn" {
  description = "RDS read replica ARN"
  value       = var.enable_read_replica ? aws_db_instance.read_replica[0].arn : null
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_auth_token" {
  description = "Redis auth token"
  value       = random_password.redis.result
  sensitive   = true
}

output "redis_node_type" {
  description = "Redis node type"
  value       = aws_elasticache_replication_group.redis.node_type
}

output "redis_num_cache_clusters" {
  description = "Number of Redis cache clusters"
  value       = aws_elasticache_replication_group.redis.num_cache_clusters
}

output "redis_replication_group_id" {
  description = "Redis replication group ID"
  value       = aws_elasticache_replication_group.redis.id
}

output "redis_security_group_id" {
  description = "Redis security group ID"
  value       = aws_security_group.redis.id
}

output "redis_subnet_group_name" {
  description = "Redis subnet group name"
  value       = aws_elasticache_subnet_group.redis.name
}

output "database_secret_arn" {
  description = "ARN of the database secret in Secrets Manager"
  value       = aws_secretsmanager_secret.database.arn
}

output "database_secret_name" {
  description = "Name of the database secret in Secrets Manager"
  value       = aws_secretsmanager_secret.database.name
}

output "redis_secret_arn" {
  description = "ARN of the Redis secret in Secrets Manager"
  value       = aws_secretsmanager_secret.redis.arn
}

output "redis_secret_name" {
  description = "Name of the Redis secret in Secrets Manager"
  value       = aws_secretsmanager_secret.redis.name
}

output "database_backup_vault_arn" {
  description = "ARN of the database backup vault"
  value       = aws_backup_vault.database.arn
}

output "database_backup_plan_arn" {
  description = "ARN of the database backup plan"
  value       = aws_backup_plan.database.arn
}

output "database_event_subscription_arn" {
  description = "ARN of the database event subscription"
  value       = aws_db_event_subscription.main.arn
}

output "database_cloudwatch_log_groups" {
  description = "CloudWatch log groups for the database"
  value = {
    for log_type in var.enable_cloudwatch_logs_exports :
    log_type => "/aws/rds/instance/${aws_db_instance.primary.identifier}/${log_type}"
  }
}

output "redis_cloudwatch_log_group" {
  description = "CloudWatch log group for Redis slow logs"
  value       = aws_cloudwatch_log_group.redis_slow.name
}
