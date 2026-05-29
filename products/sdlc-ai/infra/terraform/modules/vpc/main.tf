# VPC Module for SDLC.ai Platform
# Creates a secure, multi-AZ VPC with public, private, and database subnets

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-vpc"
      Type = "Main VPC"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-igw"
      Type = "Internet Gateway"
    }
  )
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(var.public_subnets)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnets[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-public-subnet-${count.index + 1}"
      Type = "Public Subnet"
      AZ   = data.aws_availability_zones.available.names[count.index]
    }
  )
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-public-rt"
      Type = "Public Route Table"
    }
  )
}

# Public Route
resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

# Associate Public Subnets with Public Route Table
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count = length(var.private_subnets)
  domain = "vpc"

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-nat-eip-${count.index + 1}"
      Type = "NAT Elastic IP"
    }
  )

  depends_on = [aws_internet_gateway.main]
}

# NAT Gateways
resource "aws_nat_gateway" "main" {
  count = length(var.private_subnets)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-nat-${count.index + 1}"
      Type = "NAT Gateway"
      AZ   = data.aws_availability_zones.available.names[count.index]
    }
  )

  depends_on = [aws_internet_gateway.main]
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(var.private_subnets)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-private-subnet-${count.index + 1}"
      Type = "Private Subnet"
      AZ   = data.aws_availability_zones.available.names[count.index]
      "kubernetes.io/cluster/${var.cluster_name}" = "shared"
      "kubernetes.io/role/internal-elb" = "1"
    }
  )
}

# Private Route Tables
resource "aws_route_table" "private" {
  count = length(var.private_subnets)

  vpc_id = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-private-rt-${count.index + 1}"
      Type = "Private Route Table"
      AZ   = data.aws_availability_zones.available.names[count.index]
    }
  )
}

# Private Routes through NAT
resource "aws_route" "private_nat" {
  count = length(var.private_subnets)

  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[count.index].id
}

# Associate Private Subnets with Private Route Tables
resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Database Subnets
resource "aws_subnet" "database" {
  count = length(var.database_subnets)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.database_subnets[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-db-subnet-${count.index + 1}"
      Type = "Database Subnet"
      AZ   = data.aws_availability_zones.available.names[count.index]
    }
  )
}

# Database Route Table
resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-db-rt"
      Type = "Database Route Table"
    }
  )
}

# Database Route through NAT (for patching/maintenance)
resource "aws_route" "database_nat" {
  route_table_id         = aws_route_table.database.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[0].id
}

# Associate Database Subnets with Database Route Table
resource "aws_route_table_association" "database" {
  count = length(aws_subnet.database)

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# Database Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.database[*].id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-db-subnet-group"
      Type = "Database Subnet Group"
    }
  )
}

# VPC Flow Logs
resource "aws_flow_log" "main" {
  count = var.enable_flow_logs ? 1 : 0

  iam_role_arn    = aws_iam_role.flow_log[0].arn
  log_destination = aws_cloudwatch_log_group.flow_log[0].arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-flow-log"
      Type = "VPC Flow Log"
    }
  )
}

# CloudWatch Log Group for Flow Logs
resource "aws_cloudwatch_log_group" "flow_log" {
  count = var.enable_flow_logs ? 1 : 0

  name              = "/aws/vpc/flow-logs/${var.name_prefix}"
  retention_in_days = var.log_retention_days

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-flow-log-group"
      Type = "CloudWatch Log Group"
    }
  )
}

# IAM Role for VPC Flow Logs
resource "aws_iam_role" "flow_log" {
  count = var.enable_flow_logs ? 1 : 0

  name = "${var.name_prefix}-vpc-flow-log-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-flow-log-role"
      Type = "IAM Role"
    }
  )
}

# IAM Policy for VPC Flow Logs
resource "aws_iam_role_policy" "flow_log" {
  count = var.enable_flow_logs ? 1 : 0

  name = "${var.name_prefix}-vpc-flow-log-policy"
  role = aws_iam_role.flow_log[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "${aws_cloudwatch_log_group.flow_log[0].arn}:*"
      }
    ]
  })
}

# VPC Endpoint for S3
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.aws_region}.s3"

  route_table_ids = concat(
    aws_route_table.private[*].id,
    [aws_route_table.database.id]
  )

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-s3-endpoint"
      Type = "VPC Endpoint"
    }
  )
}

# VPC Endpoint for DynamoDB
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.aws_region}.dynamodb"

  route_table_ids = aws_route_table.private[*].id

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-dynamodb-endpoint"
      Type = "VPC Endpoint"
    }
  )
}

# Security Group for VPC Endpoints
resource "aws_security_group" "vpc_endpoints" {
  name        = "${var.name_prefix}-vpc-endpoints-sg"
  description = "Security group for VPC endpoints"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-vpc-endpoints-sg"
      Type = "Security Group"
    }
  )
}
