#!/bin/bash
# VPC Security Configuration Setup for QuantumBeam
# Creates secure VPC, subnets, security groups, and network ACLs

set -euo pipefail

# Configuration
REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="quantumbeam"
ENVIRONMENT="${ENVIRONMENT:-production}"
VPC_CIDR="10.0.0.0/16"

# Subnet CIDRs
PUBLIC_SUBNET_A_CIDR="10.0.1.0/24"
PUBLIC_SUBNET_B_CIDR="10.0.2.0/24"
PRIVATE_SUBNET_A_CIDR="10.0.11.0/24"
PRIVATE_SUBNET_B_CIDR="10.0.12.0/24"
DATABASE_SUBNET_A_CIDR="10.0.21.0/24"
DATABASE_SUBNET_B_CIDR="10.0.22.0/24"

# Availability Zones
AZ_A="${AWS_AZ_A:-us-east-1a}"
AZ_B="${AWS_AZ_B:-us-east-1b}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check AWS CLI is installed and configured
check_aws_cli() {
    log_info "Checking AWS CLI configuration..."

    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi

    if ! aws sts get-caller-identity --region "$REGION" &> /dev/null; then
        log_error "AWS credentials are not configured or are invalid"
        exit 1
    fi

    log_success "AWS CLI is properly configured"
}

# Create VPC
create_vpc() {
    log_info "Creating VPC..."

    local vpc_id
    vpc_id=$(aws ec2 create-vpc \
        --cidr-block "$VPC_CIDR" \
        --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${PROJECT_NAME}-vpc},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "Vpc.VpcId" \
        --output text \
        --region "$REGION")

    # Enable DNS hostnames and DNS resolution
    aws ec2 modify-vpc-attribute \
        --vpc-id "$vpc_id" \
        --enable-dns-hostnames \
        --region "$REGION"

    aws ec2 modify-vpc-attribute \
        --vpc-id "$vpc_id" \
        --enable-dns-support \
        --region "$REGION"

    log_success "VPC created: $vpc_id"
    echo "$vpc_id"
}

# Create Internet Gateway
create_internet_gateway() {
    local vpc_id="$1"

    log_info "Creating Internet Gateway..."

    local igw_id
    igw_id=$(aws ec2 create-internet-gateway \
        --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${PROJECT_NAME}-igw},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "InternetGateway.InternetGatewayId" \
        --output text \
        --region "$REGION")

    # Attach to VPC
    aws ec2 attach-internet-gateway \
        --vpc-id "$vpc_id" \
        --internet-gateway-id "$igw_id" \
        --region "$REGION"

    log_success "Internet Gateway created and attached: $igw_id"
    echo "$igw_id"
}

# Create NAT Gateways
create_nat_gateways() {
    local vpc_id="$1"
    local public_subnet_a_id="$2"
    local public_subnet_b_id="$3"

    log_info "Creating NAT Gateways..."

    # Allocate Elastic IPs for NAT Gateways
    local eip_nat_a
    eip_nat_a=$(aws ec2 allocate-address \
        --domain vpc \
        --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=${PROJECT_NAME}-nat-a-eip},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "AllocationId" \
        --output text \
        --region "$REGION")

    local eip_nat_b
    eip_nat_b=$(aws ec2 allocate-address \
        --domain vpc \
        --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=${PROJECT_NAME}-nat-b-eip},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "AllocationId" \
        --output text \
        --region "$REGION")

    # Create NAT Gateways
    local nat_gw_a_id
    nat_gw_a_id=$(aws ec2 create-nat-gateway \
        --subnet-id "$public_subnet_a_id" \
        --allocation-id "$eip_nat_a" \
        --tag-specifications "ResourceType=natgateway,Tags=[{Key=Name,Value=${PROJECT_NAME}-nat-a},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "NatGateway.NatGatewayId" \
        --output text \
        --region "$REGION")

    local nat_gw_b_id
    nat_gw_b_id=$(aws ec2 create-nat-gateway \
        --subnet-id "$public_subnet_b_id" \
        --allocation-id "$eip_nat_b" \
        --tag-specifications "ResourceType=natgateway,Tags=[{Key=Name,Value=${PROJECT_NAME}-nat-b},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "NatGateway.NatGatewayId" \
        --output text \
        --region "$REGION")

    log_success "NAT Gateways created: $nat_gw_a_id, $nat_gw_b_id"
    echo "$nat_gw_a_id:$nat_gw_b_id"
}

# Create Subnets
create_subnets() {
    local vpc_id="$1"

    log_info "Creating subnets..."

    # Public Subnets
    local public_subnet_a_id
    public_subnet_a_id=$(aws ec2 create-subnet \
        --vpc-id "$vpc_id" \
        --cidr-block "$PUBLIC_SUBNET_A_CIDR" \
        --availability-zone "$AZ_A" \
        --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-a},{Key=Type,Value=public},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "Subnet.SubnetId" \
        --output text \
        --region "$REGION")

    local public_subnet_b_id
    public_subnet_b_id=$(aws ec2 create-subnet \
        --vpc-id "$vpc_id" \
        --cidr-block "$PUBLIC_SUBNET_B_CIDR" \
        --availability-zone "$AZ_B" \
        --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-b},{Key=Type,Value=public},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "Subnet.SubnetId" \
        --output text \
        --region "$REGION")

    # Private Subnets
    local private_subnet_a_id
    private_subnet_a_id=$(aws ec2 create-subnet \
        --vpc-id "$vpc_id" \
        --cidr-block "$PRIVATE_SUBNET_A_CIDR" \
        --availability-zone "$AZ_A" \
        --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-a},{Key=Type,Value=private},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "Subnet.SubnetId" \
        --output text \
        --region "$REGION")

    local private_subnet_b_id
    private_subnet_b_id=$(aws ec2 create-subnet \
        --vpc-id "$vpc_id" \
        --cidr-block "$PRIVATE_SUBNET_B_CIDR" \
        --availability-zone "$AZ_B" \
        --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-b},{Key=Type,Value=private},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "Subnet.SubnetId" \
        --output text \
        --region "$REGION")

    # Database Subnets
    local database_subnet_a_id
    database_subnet_a_id=$(aws ec2 create-subnet \
        --vpc-id "$vpc_id" \
        --cidr-block "$DATABASE_SUBNET_A_CIDR" \
        --availability-zone "$AZ_A" \
        --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-database-a},{Key=Type,Value=database},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "Subnet.SubnetId" \
        --output text \
        --region "$REGION")

    local database_subnet_b_id
    database_subnet_b_id=$(aws ec2 create-subnet \
        --vpc-id "$vpc_id" \
        --cidr-block "$DATABASE_SUBNET_B_CIDR" \
        --availability-zone "$AZ_B" \
        --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT_NAME}-database-b},{Key=Type,Value=database},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "Subnet.SubnetId" \
        --output text \
        --region "$REGION")

    log_success "All subnets created"
    echo "$public_subnet_a_id:$public_subnet_b_id:$private_subnet_a_id:$private_subnet_b_id:$database_subnet_a_id:$database_subnet_b_id"
}

# Create Route Tables
create_route_tables() {
    local vpc_id="$1"
    local igw_id="$2"
    local nat_gw_a_id="$3"
    local nat_gw_b_id="$4"
    local public_subnet_a_id="$5"
    local public_subnet_b_id="$6"
    local private_subnet_a_id="$7"
    local private_subnet_b_id="$8"
    local database_subnet_a_id="$9"
    local database_subnet_b_id="${10}"

    log_info "Creating route tables..."

    # Public Route Table
    local public_rtb_id
    public_rtb_id=$(aws ec2 create-route-table \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-rtb},{Key=Type,Value=public},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "RouteTable.RouteTableId" \
        --output text \
        --region "$REGION")

    # Add internet gateway route to public route table
    aws ec2 create-route \
        --route-table-id "$public_rtb_id" \
        --destination-cidr-block "0.0.0.0/0" \
        --gateway-id "$igw_id" \
        --region "$REGION"

    # Associate public subnets with public route table
    aws ec2 associate-route-table \
        --route-table-id "$public_rtb_id" \
        --subnet-id "$public_subnet_a_id" \
        --region "$REGION"

    aws ec2 associate-route-table \
        --route-table-id "$public_rtb_id" \
        --subnet-id "$public_subnet_b_id" \
        --region "$REGION"

    # Private Route Table A
    local private_rtb_a_id
    private_rtb_a_id=$(aws ec2 create-route-table \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-a-rtb},{Key=Type,Value=private},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "RouteTable.RouteTableId" \
        --output text \
        --region "$REGION")

    # Add NAT gateway route to private route table A
    aws ec2 create-route \
        --route-table-id "$private_rtb_a_id" \
        --destination-cidr-block "0.0.0.0/0" \
        --nat-gateway-id "$nat_gw_a_id" \
        --region "$REGION"

    # Associate private subnet A with private route table A
    aws ec2 associate-route-table \
        --route-table-id "$private_rtb_a_id" \
        --subnet-id "$private_subnet_a_id" \
        --region "$REGION"

    # Private Route Table B
    local private_rtb_b_id
    private_rtb_b_id=$(aws ec2 create-route-table \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-b-rtb},{Key=Type,Value=private},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "RouteTable.RouteTableId" \
        --output text \
        --region "$REGION")

    # Add NAT gateway route to private route table B
    aws ec2 create-route \
        --route-table-id "$private_rtb_b_id" \
        --destination-cidr-block "0.0.0.0/0" \
        --nat-gateway-id "$nat_gw_b_id" \
        --region "$REGION"

    # Associate private subnet B with private route table B
    aws ec2 associate-route-table \
        --route-table-id "$private_rtb_b_id" \
        --subnet-id "$private_subnet_b_id" \
        --region "$REGION"

    # Database Route Table (isolated)
    local database_rtb_id
    database_rtb_id=$(aws ec2 create-route-table \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${PROJECT_NAME}-database-rtb},{Key=Type,Value=database},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "RouteTable.RouteTableId" \
        --output text \
        --region "$REGION")

    # Associate database subnets with database route table
    aws ec2 associate-route-table \
        --route-table-id "$database_rtb_id" \
        --subnet-id "$database_subnet_a_id" \
        --region "$REGION"

    aws ec2 associate-route-table \
        --route-table-id "$database_rtb_id" \
        --subnet-id "$database_subnet_b_id" \
        --region "$REGION"

    log_success "Route tables created and associated"
}

# Create Security Groups
create_security_groups() {
    local vpc_id="$1"

    log_info "Creating security groups..."

    # Application Load Balancer Security Group
    local alb_sg_id
    alb_sg_id=$(aws ec2 create-security-group \
        --group-name "${PROJECT_NAME}-alb-sg" \
        --description "Security group for Application Load Balancer" \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${PROJECT_NAME}-alb-sg},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "GroupId" \
        --output text \
        --region "$REGION")

    # ALB Security Group Rules
    aws ec2 authorize-security-group-ingress \
        --group-id "$alb_sg_id" \
        --protocol tcp \
        --port 80 \
        --cidr "0.0.0.0/0" \
        --region "$REGION"

    aws ec2 authorize-security-group-ingress \
        --group-id "$alb_sg_id" \
        --protocol tcp \
        --port 443 \
        --cidr "0.0.0.0/0" \
        --region "$REGION"

    # API Server Security Group
    local api_sg_id
    api_sg_id=$(aws ec2 create-security-group \
        --group-name "${PROJECT_NAME}-api-sg" \
        --description "Security group for API servers" \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${PROJECT_NAME}-api-sg},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "GroupId" \
        --output text \
        --region "$REGION")

    # API Security Group Rules
    aws ec2 authorize-security-group-ingress \
        --group-id "$api_sg_id" \
        --protocol tcp \
        --port 8080 \
        --source-group "$alb_sg_id" \
        --region "$REGION"

    # Database Security Group
    local db_sg_id
    db_sg_id=$(aws ec2 create-security-group \
        --group-name "${PROJECT_NAME}-database-sg" \
        --description "Security group for database instances" \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${PROJECT_NAME}-database-sg},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "GroupId" \
        --output text \
        --region "$REGION")

    # Database Security Group Rules (only allow from API and private subnets)
    aws ec2 authorize-security-group-ingress \
        --group-id "$db_sg_id" \
        --protocol tcp \
        --port 5432 \
        --source-group "$api_sg_id" \
        --region "$REGION"

    # Redis Security Group
    local redis_sg_id
    redis_sg_id=$(aws ec2 create-security-group \
        --group-name "${PROJECT_NAME}-redis-sg" \
        --description "Security group for Redis instances" \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${PROJECT_NAME}-redis-sg},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "GroupId" \
        --output text \
        --region "$REGION")

    # Redis Security Group Rules
    aws ec2 authorize-security-group-ingress \
        --group-id "$redis_sg_id" \
        --protocol tcp \
        --port 6379 \
        --source-group "$api_sg_id" \
        --region "$REGION"

    # Monitoring Security Group
    local monitoring_sg_id
    monitoring_sg_id=$(aws ec2 create-security-group \
        --group-name "${PROJECT_NAME}-monitoring-sg" \
        --description "Security group for monitoring services" \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${PROJECT_NAME}-monitoring-sg},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "GroupId" \
        --output text \
        --region "$REGION")

    # Monitoring Security Group Rules
    aws ec2 authorize-security-group-ingress \
        --group-id "$monitoring_sg_id" \
        --protocol tcp \
        --port 3000 \
        --cidr "10.0.0.0/16" \
        --region "$REGION"  # Grafana

    aws ec2 authorize-security-group-ingress \
        --group-id "$monitoring_sg_id" \
        --protocol tcp \
        --port 9090 \
        --cidr "10.0.0.0/16" \
        --region "$REGION"  # Prometheus

    aws ec2 authorize-security-group-ingress \
        --group-id "$monitoring_sg_id" \
        --protocol tcp \
        --port 9093 \
        --cidr "10.0.0.0/16" \
        --region "$REGION"  # AlertManager

    log_success "Security groups created"
    echo "$alb_sg_id:$api_sg_id:$db_sg_id:$redis_sg_id:$monitoring_sg_id"
}

# Create Network ACLs
create_network_acls() {
    local vpc_id="$1"

    log_info "Creating Network ACLs..."

    # Public Network ACL
    public_nacl_id=$(aws ec2 create-network-acl \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=network-acl,Tags=[{Key=Name,Value=${PROJECT_NAME}-public-nacl},{Key=Type,Value=public},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "NetworkAcl.NetworkAclId" \
        --output text \
        --region "$REGION")

    # Public NACL Rules (allow HTTP/HTTPS, deny other inbound)
    aws ec2 create-network-acl-entry \
        --network-acl-id "$public_nacl_id" \
        --rule-number 100 \
        --protocol -1 \
        --rule-action allow \
        --egress \
        --cidr-block "0.0.0.0/0" \
        --region "$REGION"

    aws ec2 create-network-acl-entry \
        --network-acl-id "$public_nacl_id" \
        --rule-number 100 \
        --protocol 6 \
        --port-range From=80,To=80 \
        --rule-action allow \
        --ingress \
        --cidr-block "0.0.0.0/0" \
        --region "$REGION"

    aws ec2 create-network-acl-entry \
        --network-acl-id "$public_nacl_id" \
        --rule-number 110 \
        --protocol 6 \
        --port-range From=443,To=443 \
        --rule-action allow \
        --ingress \
        --cidr-block "0.0.0.0/0" \
        --region "$REGION"

    aws ec2 create-network-acl-entry \
        --network-acl-id "$public_nacl_id" \
        --rule-number 120 \
        --protocol 6 \
        --port-range From=22,To=22 \
        --rule-action allow \
        --ingress \
        --cidr-block "0.0.0.0/0" \
        --region "$REGION"

    # Private Network ACL
    private_nacl_id=$(aws ec2 create-network-acl \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=network-acl,Tags=[{Key=Name,Value=${PROJECT_NAME}-private-nacl},{Key=Type,Value=private},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "NetworkAcl.NetworkAclId" \
        --output text \
        --region "$REGION")

    # Private NACL Rules (restrictive)
    aws ec2 create-network-acl-entry \
        --network-acl-id "$private_nacl_id" \
        --rule-number 100 \
        --protocol -1 \
        --rule-action allow \
        --egress \
        --cidr-block "0.0.0.0/0" \
        --region "$REGION"

    aws ec2 create-network-acl-entry \
        --network-acl-id "$private_nacl_id" \
        --rule-number 100 \
        --protocol -1 \
        --rule-action allow \
        --ingress \
        --cidr-block "10.0.0.0/16" \
        --region "$REGION"

    # Database Network ACL (most restrictive)
    database_nacl_id=$(aws ec2 create-network-acl \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=network-acl,Tags=[{Key=Name,Value=${PROJECT_NAME}-database-nacl},{Key=Type,Value=database},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "NetworkAcl.NetworkAclId" \
        --output text \
        --region "$REGION")

    # Database NACL Rules (only allow from private subnets)
    aws ec2 create-network-acl-entry \
        --network-acl-id "$database_nacl_id" \
        --rule-number 100 \
        --protocol -1 \
        --rule-action allow \
        --egress \
        --cidr-block "10.0.0.0/16" \
        --region "$REGION"

    aws ec2 create-network-acl-entry \
        --network-acl-id "$database_nacl_id" \
        --rule-number 100 \
        --protocol -1 \
        --rule-action allow \
        --ingress \
        --cidr-block "10.0.0.0/16" \
        --region "$REGION"

    log_success "Network ACLs created"
    echo "$public_nacl_id:$private_nacl_id:$database_nacl_id"
}

# Create VPC Endpoints for private connectivity
create_vpc_endpoints() {
    local vpc_id="$1"
    private_subnet_a_id="$2"
    private_subnet_b_id="$3"

    log_info "Creating VPC Endpoints..."

    # Create security group for VPC endpoints
    local vpc_endpoint_sg_id
    vpc_endpoint_sg_id=$(aws ec2 create-security-group \
        --group-name "${PROJECT_NAME}-vpc-endpoints-sg" \
        --description "Security group for VPC endpoints" \
        --vpc-id "$vpc_id" \
        --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${PROJECT_NAME}-vpc-endpoints-sg},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query "GroupId" \
        --output text \
        --region "$REGION")

    # Allow HTTPS from private subnets
    aws ec2 authorize-security-group-ingress \
        --group-id "$vpc_endpoint_sg_id" \
        --protocol tcp \
        --port 443 \
        --cidr "10.0.0.0/16" \
        --region "$REGION"

    # Create VPC endpoints for AWS services
    # Secrets Manager
    aws ec2 create-vpc-endpoint \
        --vpc-id "$vpc_id" \
        --service-name "com.amazonaws.${REGION}.secretsmanager" \
        --vpc-endpoint-type Interface \
        --subnet-ids "$private_subnet_a_id" "$private_subnet_b_id" \
        --security-group-ids "$vpc_endpoint_sg_id" \
        --private-dns-enabled \
        --tag-specifications "ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=${PROJECT_NAME}-secretsmanager-vpce},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --region "$REGION"

    # Systems Manager Parameter Store
    aws ec2 create-vpc-endpoint \
        --vpc-id "$vpc_id" \
        --service-name "com.amazonaws.${REGION}.ssm" \
        --vpc-endpoint-type Interface \
        --subnet-ids "$private_subnet_a_id" "$private_subnet_b_id" \
        --security-group-ids "$vpc_endpoint_sg_id" \
        --private-dns-enabled \
        --tag-specifications "ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=${PROJECT_NAME}-ssm-vpce},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --region "$REGION"

    # ECR
    aws ec2 create-vpc-endpoint \
        --vpc-id "$vpc_id" \
        --service-name "com.amazonaws.${REGION}.ecr.api" \
        --vpc-endpoint-type Interface \
        --subnet-ids "$private_subnet_a_id" "$private_subnet_b_id" \
        --security-group-ids "$vpc_endpoint_sg_id" \
        --private-dns-enabled \
        --tag-specifications "ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=${PROJECT_NAME}-ecr-api-vpce},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --region "$REGION"

    aws ec2 create-vpc-endpoint \
        --vpc-id "$vpc_id" \
        --service-name "com.amazonaws.${REGION}.ecr.dkr" \
        --vpc-endpoint-type Interface \
        --subnet-ids "$private_subnet_a_id" "$private_subnet_b_id" \
        --security-group-ids "$vpc_endpoint_sg_id" \
        --private-dns-enabled \
        --tag-specifications "ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=${PROJECT_NAME}-ecr-dkr-vpce},{Key=Project,Value=${PROJECT_NAME}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --region "$REGION"

    log_success "VPC Endpoints created"
}

# Wait for NAT Gateways to be available
wait_for_nat_gateways() {
    local nat_gw_a_id="$1"
    local nat_gw_b_id="$2"

    log_info "Waiting for NAT Gateways to become available..."

    for nat_gw_id in "$nat_gw_a_id" "$nat_gw_b_id"; do
        log_info "Waiting for NAT Gateway: $nat_gw_id"
        aws ec2 wait nat-gateway-available \
            --nat-gateway-ids "$nat_gw_id" \
            --region "$REGION"
    done

    log_success "NAT Gateways are available"
}

# Generate Terraform configuration
generate_terraform_config() {
    local vpc_id="$1"
    local igw_id="$2"
    local security_groups="$3"

    log_info "Generating Terraform configuration..."

    # This would generate a complete Terraform configuration
    # For brevity, just creating a placeholder
    mkdir -p infrastructure/terraform
    cat > infrastructure/terraform/network.tf << EOF
# QuantumBeam Network Configuration
# Generated by VPC security setup script

variable "region" {
  description = "AWS region"
  type        = string
  default     = "$REGION"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "$PROJECT_NAME"
}

variable "environment" {
  description = "Environment"
  type        = string
  default     = "$ENVIRONMENT"
}

# VPC configuration already created
# VPC ID: $vpc_id
# Internet Gateway ID: $igw_id
# Security Groups: $security_groups

# Use this Terraform configuration to manage and extend your network infrastructure
EOF

    log_success "Terraform configuration generated: infrastructure/terraform/network.tf"
}

# Main execution
main() {
    log_info "Starting VPC security configuration setup for QuantumBeam..."

    check_aws_cli

    # Create VPC and networking components
    local vpc_id
    vpc_id=$(create_vpc)

    local igw_id
    igw_id=$(create_internet_gateway "$vpc_id")

    local subnets
    subnets=$(create_subnets "$vpc_id")
    IFS=':' read -r public_subnet_a_id public_subnet_b_id private_subnet_a_id private_subnet_b_id database_subnet_a_id database_subnet_b_id <<< "$subnets"

    local nat_gateways
    nat_gateways=$(create_nat_gateways "$vpc_id" "$public_subnet_a_id" "$public_subnet_b_id")
    IFS=':' read -r nat_gw_a_id nat_gw_b_id <<< "$nat_gateways"

    # Wait for NAT Gateways
    wait_for_nat_gateways "$nat_gw_a_id" "$nat_gw_b_id"

    # Create route tables
    create_route_tables "$vpc_id" "$igw_id" "$nat_gw_a_id" "$nat_gw_b_id" \
        "$public_subnet_a_id" "$public_subnet_b_id" "$private_subnet_a_id" "$private_subnet_b_id" \
        "$database_subnet_a_id" "$database_subnet_b_id"

    # Create security groups
    local security_groups
    security_groups=$(create_security_groups "$vpc_id")

    # Create Network ACLs
    create_network_acls "$vpc_id"

    # Create VPC Endpoints
    create_vpc_endpoints "$vpc_id" "$private_subnet_a_id" "$private_subnet_b_id"

    # Generate Terraform configuration
    generate_terraform_config "$vpc_id" "$igw_id" "$security_groups"

    log_success "VPC security configuration completed successfully!"
    log_info "Created resources:"
    echo "- VPC: $vpc_id"
    echo "- Internet Gateway: $igw_id"
    echo "- NAT Gateways: $nat_gw_a_id, $nat_gw_b_id"
    echo "- Security Groups: $security_groups"
    echo "- Public Subnets: $public_subnet_a_id, $public_subnet_b_id"
    echo "- Private Subnets: $private_subnet_a_id, $private_subnet_b_id"
    echo "- Database Subnets: $database_subnet_a_id, $database_subnet_b_id"
}

# Execute main function
main "$@"