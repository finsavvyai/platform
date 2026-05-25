# Production VPC Configuration
resource "aws_vpc" "production" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-vpc"
      Environment = "production"
      Type = "vpc"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "production" {
  vpc_id = aws_vpc.production.id

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-igw"
      Environment = "production"
      Type = "internet-gateway"
    }
  )
}

# NAT Gateways
resource "aws_eip" "nat" {
  count = length(var.availability_zones)
  domain = "vpc"

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-nat-eip-${count.index + 1}"
      Environment = "production"
      Type = "elastic-ip"
    }
  )

  depends_on = [aws_internet_gateway.production]
}

resource "aws_nat_gateway" "production" {
  count         = length(var.availability_zones)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-nat-gw-${count.index + 1}"
      Environment = "production"
      Type = "nat-gateway"
    }
  )

  depends_on = [aws_internet_gateway.production]
}

# Public Subnets
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.production.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-public-subnet-${count.index + 1}"
      Environment = "production"
      Type = "public-subnet"
      "kubernetes.io/cluster/${aws_eks_cluster.production.name}" = "shared"
      "kubernetes.io/role/elb" = "1"
    }
  )
}

# Private Subnets (for applications)
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.production.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = var.availability_zones[count.index]

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-private-subnet-${count.index + 1}"
      Environment = "production"
      Type = "private-subnet"
      "kubernetes.io/cluster/${aws_eks_cluster.production.name}" = "shared"
      "kubernetes.io/role/internal-elb" = "1"
    }
  )
}

# Private Database Subnets
resource "aws_subnet" "database" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.production.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 20)
  availability_zone = var.availability_zones[count.index]

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-database-subnet-${count.index + 1}"
      Environment = "production"
      Type = "database-subnet"
    }
  )
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.production.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.production.id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-public-rt"
      Environment = "production"
      Type = "route-table"
    }
  )
}

resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.production.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.production[count.index].id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-private-rt-${count.index + 1}"
      Environment = "production"
      Type = "route-table"
    }
  )
}

resource "aws_route_table" "database" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.production.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.production[count.index].id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-database-rt-${count.index + 1}"
      Environment = "production"
      Type = "route-table"
    }
  )
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "database" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database[count.index].id
}

# VPC Endpoints for Security
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.production.id
  service_name = "com.amazonaws.${var.aws_region}.s3"
  route_table_ids = concat(
    aws_route_table.private[*].id,
    aws_route_table.database[*].id
  )

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-s3-vpce"
      Environment = "production"
      Type = "vpc-endpoint"
    }
  )
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.production.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-ecr-dkr-vpce"
      Environment = "production"
      Type = "vpc-endpoint"
    }
  )
}

resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.production.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-ecr-api-vpce"
      Environment = "production"
      Type = "vpc-endpoint"
    }
  )
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.production.id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-secretsmanager-vpce"
      Environment = "production"
      Type = "vpc-endpoint"
    }
  )
}

resource "aws_vpc_endpoint" "ssm" {
  vpc_id              = aws_vpc.production.id
  service_name        = "com.amazonaws.${var.aws_region}.ssm"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-ssm-vpce"
      Environment = "production"
      Type = "vpc-endpoint"
    }
  )
}

resource "aws_vpc_endpoint" "ssmmessages" {
  vpc_id              = aws_vpc.production.id
  service_name        = "com.amazonaws.${var.aws_region}.ssmmessages"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-ssmmessages-vpce"
      Environment = "production"
      Type = "vpc-endpoint"
    }
  )
}

resource "aws_vpc_endpoint" "ec2" {
  vpc_id              = aws_vpc.production.id
  service_name        = "com.amazonaws.${var.aws_region}.ec2"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-ec2-vpce"
      Environment = "production"
      Type = "vpc-endpoint"
    }
  )
}

resource "aws_vpc_endpoint" "kms" {
  vpc_id              = aws_vpc.production.id
  service_name        = "com.amazonaws.${var.aws_region}.kms"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-kms-vpce"
      Environment = "production"
      Type = "vpc-endpoint"
    }
  )
}

# Security Groups
resource "aws_security_group" "vpc_endpoints" {
  name        = "quantumbeam-production-vpc-endpoints-sg"
  description = "Security group for VPC endpoints"
  vpc_id      = aws_vpc.production.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    security_groups = [
      aws_security_group.eks_nodes.id,
      aws_security_group.eks_cluster.id
    ]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-vpc-endpoints-sg"
      Environment = "production"
      Type = "security-group"
    }
  )
}

resource "aws_security_group" "eks_cluster" {
  name        = "quantumbeam-production-eks-cluster-sg"
  description = "Security group for EKS cluster"
  vpc_id      = aws_vpc.production.id

  # Allow API server to communicate with worker nodes
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow worker nodes to communicate with API server
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  # Allow bastion host to access API server
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-eks-cluster-sg"
      Environment = "production"
      Type = "security-group"
    }
  )
}

resource "aws_security_group" "eks_nodes" {
  name        = "quantumbeam-production-eks-nodes-sg"
  description = "Security group for EKS worker nodes"
  vpc_id      = aws_vpc.production.id

  # Allow all traffic between nodes in the same security group
  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  # Allow all egress traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow NodePort communication
  ingress {
    from_port   = 30000
    to_port     = 32767
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.production.cidr_block]
  }

  # Allow bastion host to access nodes for debugging
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-eks-nodes-sg"
      Environment = "production"
      Type = "security-group"
    }
  )
}

resource "aws_security_group" "bastion" {
  name        = "quantumbeam-production-bastion-sg"
  description = "Security group for bastion host"
  vpc_id      = aws_vpc.production.id

  # Allow SSH from allowed IPs
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.bastion_allowed_cidrs
  }

  # Allow all egress traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-bastion-sg"
      Environment = "production"
      Type = "security-group"
    }
  )
}

# Network ACLs for additional security
resource "aws_network_acl" "public" {
  vpc_id     = aws_vpc.production.id
  subnet_ids = aws_subnet.public[*].id

  # Allow SSH inbound
  ingress {
    rule_no    = 100
    action     = "allow"
    from_port  = 22
    to_port    = 22
    protocol   = "tcp"
    cidr_block = "0.0.0.0/0"
  }

  # Allow HTTP/HTTPS inbound
  ingress {
    rule_no    = 110
    action     = "allow"
    from_port  = 80
    to_port    = 80
    protocol   = "tcp"
    cidr_block = "0.0.0.0/0"
  }

  ingress {
    rule_no    = 120
    action     = "allow"
    from_port  = 443
    to_port    = 443
    protocol   = "tcp"
    cidr_block = "0.0.0.0/0"
  }

  # Allow egress to anywhere
  egress {
    rule_no    = 100
    action     = "allow"
    from_port  = 0
    to_port    = 0
    protocol   = "-1"
    cidr_block = "0.0.0.0/0"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-public-nacl"
      Environment = "production"
      Type = "network-acl"
    }
  )
}

resource "aws_network_acl" "private" {
  vpc_id     = aws_vpc.production.id
  subnet_ids = concat(aws_subnet.private[*].id, aws_subnet.database[*].id)

  # Allow all traffic within VPC
  ingress {
    rule_no    = 100
    action     = "allow"
    from_port  = 0
    to_port    = 0
    protocol   = "-1"
    cidr_block = aws_vpc.production.cidr_block
  }

  # Allow egress to anywhere
  egress {
    rule_no    = 100
    action     = "allow"
    from_port  = 0
    to_port    = 0
    protocol   = "-1"
    cidr_block = "0.0.0.0/0"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "quantumbeam-production-private-nacl"
      Environment = "production"
      Type = "network-acl"
    }
  )
}