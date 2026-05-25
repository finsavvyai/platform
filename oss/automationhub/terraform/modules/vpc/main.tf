# VPC Module for UPM.Plus AutomationHub
# Creates a complete VPC with public, private, and database subnets

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Get available AZs in the region
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  # Ensure we don't exceed available AZs
  max_azs = min(
    length(data.aws_availability_zones.available.names),
    length(var.public_subnet_cidrs),
    length(var.private_subnet_cidrs),
    length(var.database_subnet_cidrs)
  )

  # Use only available AZs
  az_names = slice(data.aws_availability_zones.available.names, 0, local.max_azs)
}

# VPC Resource
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-vpc"
  })
}

# DHCP Options
resource "aws_vpc_dhcp_options" "main" {
  domain_name         = "${var.environment}.upm.plus"
  domain_name_servers = ["AmazonProvidedDNS"]

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-dhcp-options"
  })
}

resource "aws_vpc_dhcp_options_association" "main" {
  vpc_id          = aws_vpc.main.id
  dhcp_options_id = aws_vpc_dhcp_options.main.id
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-igw"
  })
}

# Public Subnets
resource "aws_subnet" "public" {
  count = local.max_azs

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = local.az_names[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name                                            = "${var.environment}-upm-plus-public-subnet-${count.index + 1}"
    "kubernetes.io/cluster/${var.eks_cluster_name}" = "shared"
    "kubernetes.io/role/elb"                        = "1"
  })
}

# Route Table for Public Subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-public-rt"
  })
}

# Route Table Associations for Public Subnets
resource "aws_route_table_association" "public" {
  count = local.max_azs

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# NAT Gateway (one per AZ for high availability)
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? local.max_azs : 0
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-nat-eip-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? local.max_azs : 0

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-nat-gw-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

# Private Subnets
resource "aws_subnet" "private" {
  count = local.max_azs

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = local.az_names[count.index]

  tags = merge(var.tags, {
    Name                                            = "${var.environment}-upm-plus-private-subnet-${count.index + 1}"
    "kubernetes.io/cluster/${var.eks_cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"               = "1"
  })
}

# Route Table for Private Subnets
resource "aws_route_table" "private" {
  count = var.enable_nat_gateway ? local.max_azs : 1

  vpc_id = aws_vpc.main.id

  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.main[count.index].id
    }
  }

  tags = merge(var.tags, {
    Name = var.enable_nat_gateway ? "${var.environment}-upm-plus-private-rt-${count.index + 1}" : "${var.environment}-upm-plus-private-rt"
  })
}

# Route Table Associations for Private Subnets
resource "aws_route_table_association" "private" {
  count = local.max_azs

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = var.enable_nat_gateway ? aws_route_table.private[count.index].id : aws_route_table.private[0].id
}

# Database Subnets (isolated)
resource "aws_subnet" "database" {
  count = min(local.max_azs, length(var.database_subnet_cidrs))

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.database_subnet_cidrs[count.index]
  availability_zone = local.az_names[count.index]

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-database-subnet-${count.index + 1}"
  })
}

# Route Table for Database Subnets
resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-database-rt"
  })
}

# Route Table Associations for Database Subnets
resource "aws_route_table_association" "database" {
  count = min(local.max_azs, length(var.database_subnet_cidrs))

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# VPC Flow Logs (if enabled)
resource "aws_flow_log" "main" {
  count = var.enable_flow_logs ? 1 : 0

  iam_role_arn    = aws_iam_role.flow_log[0].arn
  log_destination = aws_cloudwatch_log_group.flow_log[0].arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-flow-logs"
  })
}

# IAM Role for Flow Logs
resource "aws_iam_role" "flow_log" {
  count = var.enable_flow_logs ? 1 : 0

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

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-flow-log-role"
  })
}

resource "aws_iam_role_policy" "flow_log" {
  count = var.enable_flow_logs ? 1 : 0

  name = "${var.environment}-upm-plus-flow-log-policy"
  role = aws_iam_role.flow_log[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Log Group for Flow Logs
resource "aws_cloudwatch_log_group" "flow_log" {
  count = var.enable_flow_logs ? 1 : 0

  name              = "/aws/vpc/flow-logs/${var.environment}-upm-plus"
  retention_in_days = 14

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-flow-log-group"
  })
}

# VPN Gateway (if enabled)
resource "aws_vpn_gateway" "main" {
  count = var.enable_vpn_gateway ? 1 : 0

  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-vpn-gateway"
  })
}

# VPC Endpoints for AWS Services (improved security and performance)
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.region}.s3"

  route_table_ids = concat(
    aws_route_table.private[*].id,
    [aws_route_table.database.id]
  )

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-s3-endpoint"
  })
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.region}.dynamodb"

  route_table_ids = concat(
    aws_route_table.private[*].id,
    [aws_route_table.database.id]
  )

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-dynamodb-endpoint"
  })
}

# VPC Endpoint Security Groups
resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "${var.environment}-upm-plus-vpc-endpoints-"
  vpc_id      = aws_vpc.main.id

  # HTTPS access for API calls
  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-vpc-endpoints-sg"
  })
}

# Interface VPC Endpoints
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [aws_security_group.vpc_endpoints.id]

  subnet_ids = aws_subnet.private[*].id

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-ecr-api-endpoint"
  })
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [aws_security_group.vpc_endpoints.id]

  subnet_ids = aws_subnet.private[*].id

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-ecr-dkr-endpoint"
  })
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.logs"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true

  security_group_ids = [aws_security_group.vpc_endpoints.id]

  subnet_ids = aws_subnet.private[*].id

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-logs-endpoint"
  })
}

# Network ACLs for additional security
resource "aws_network_acl" "public" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.public[*].id

  # Allow HTTP inbound
  ingress {
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 80
    to_port    = 80
    protocol   = "tcp"
  }

  # Allow HTTPS inbound
  ingress {
    rule_no    = 110
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 443
    to_port    = 443
    protocol   = "tcp"
  }

  # Allow ephemeral return traffic
  ingress {
    rule_no    = 120
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
    protocol   = "tcp"
  }

  # Allow all outbound
  egress {
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
    protocol   = "-1"
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-public-nacl"
  })
}

resource "aws_network_acl" "private" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.private[*].id

  # Allow HTTP outbound
  egress {
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 80
    to_port    = 80
    protocol   = "tcp"
  }

  # Allow HTTPS outbound
  egress {
    rule_no    = 110
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 443
    to_port    = 443
    protocol   = "tcp"
  }

  # Allow ephemeral traffic
  egress {
    rule_no    = 120
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
    protocol   = "tcp"
  }

  # Allow all inbound from VPC
  ingress {
    rule_no    = 100
    action     = "allow"
    cidr_block = var.vpc_cidr
    from_port  = 0
    to_port    = 0
    protocol   = "-1"
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-upm-plus-private-nacl"
  })
}