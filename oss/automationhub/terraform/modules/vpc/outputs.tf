# VPC Module Outputs

output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "public_subnet_cidrs" {
  description = "List of CIDR blocks of public subnets"
  value       = aws_subnet.public[*].cidr_block
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "private_subnet_cidrs" {
  description = "List of CIDR blocks of private subnets"
  value       = aws_subnet.private[*].cidr_block
}

output "database_subnets" {
  description = "List of IDs of database subnets"
  value       = aws_subnet.database[*].id
}

output "database_subnet_cidrs" {
  description = "List of CIDR blocks of database subnets"
  value       = aws_subnet.database[*].cidr_block
}

output "internet_gateway_id" {
  description = "The ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs"
  value       = aws_nat_gateway.main[*].id
}

output "nat_gateway_public_ips" {
  description = "List of NAT Gateway public IP addresses"
  value       = aws_eip.nat[*].public_ip
}

output "vpc_endpoint_ids" {
  description = "List of VPC endpoint IDs"
  value       = {
    s3       = aws_vpc_endpoint.s3.id
    dynamodb = aws_vpc_endpoint.dynamodb.id
    ecr_api  = aws_vpc_endpoint.ecr_api[*].id
    ecr_dkr  = aws_vpc_endpoint.ecr_dkr[*].id
    logs     = aws_vpc_endpoint.logs[*].id
  }
}

output "availability_zones" {
  description = "List of availability zones used"
  value       = local.az_names
}

output "default_security_group_id" {
  description = "The ID of the default security group"
  value       = aws_vpc.main.default_security_group_id
}