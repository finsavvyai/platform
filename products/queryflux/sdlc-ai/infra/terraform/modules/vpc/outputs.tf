output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "private_subnets" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "public_subnets" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "database_subnets" {
  description = "List of database subnet IDs"
  value       = aws_subnet.database[*].id
}

output "database_subnet_group" {
  description = "Database subnet group name"
  value       = aws_db_subnet_group.main.name
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "natgw_ids" {
  description = "List of NAT Gateway IDs"
  value       = aws_nat_gateway.main[*].id
}

output "nat_eip_ids" {
  description = "List of NAT Elastic IP IDs"
  value       = aws_eip.nat[*].id
}

output "private_route_table_ids" {
  description = "List of private route table IDs"
  value       = aws_route_table.private[*].id
}

output "public_route_table_id" {
  description = "ID of the public route table"
  value       = aws_route_table.public.id
}

output "database_route_table_id" {
  description = "ID of the database route table"
  value       = aws_route_table.database.id
}

output "vpc_endpoint_s3_id" {
  description = "ID of the S3 VPC endpoint"
  value       = aws_vpc_endpoint.s3.id
}

output "vpc_endpoint_dynamodb_id" {
  description = "ID of the DynamoDB VPC endpoint"
  value       = aws_vpc_endpoint.dynamodb.id
}

output "vpc_endpoints_security_group_id" {
  description = "ID of the VPC endpoints security group"
  value       = aws_security_group.vpc_endpoints.id
}

output "availability_zones" {
  description = "List of availability zones"
  value       = data.aws_availability_zones.available.names
}
