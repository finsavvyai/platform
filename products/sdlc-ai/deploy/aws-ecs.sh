#!/bin/bash

# SDLC Compliance Platform - AWS ECS Deployment Script
# Deploys the complete platform to Amazon ECS with all AWS services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
PROJECT_NAME="sdlc-compliance"
ECR_REPOSITORY="${PROJECT_NAME}"
ECS_CLUSTER="${PROJECT_NAME}-cluster"
ECS_SERVICE="${PROJECT_NAME}-service"
LOAD_BALANCER="${PROJECT_NAME}-lb"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

log_info "Deploying SDLC Compliance Platform to AWS ECS..."
echo "Region: $AWS_REGION"
echo "Account: $AWS_ACCOUNT_ID"

# Check AWS CLI and login
check_aws_cli() {
    log_info "Checking AWS CLI..."
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install AWS CLI v2."
        exit 1
    fi

    # Check if logged in
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "Not logged in to AWS. Please run: aws configure"
        exit 1
    fi

    log_success "AWS CLI configured"
}

# Create ECR repository
create_ecr_repository() {
    log_info "Creating ECR repository..."

    if aws ecr describe-repositories --repository-names "$ECR_REPOSITORY" --region "$AWS_REGION" &> /dev/null; then
        log_info "ECR repository already exists"
    else
        aws ecr create-repository \
            --repository-name "$ECR_REPOSITORY" \
            --region "$AWS_REGION" \
            --image-scanning-configuration scanOnPush=true \
            --image-tag-mutability MUTABLE
        log_success "Created ECR repository: $ECR_REPOSITORY"
    fi

    # Get login password and log in to ECR
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
}

# Build and push Docker image
build_and_push_image() {
    log_info "Building Docker image..."

    cd compliance-platform/gateway

    # Build the image
    docker build -t "$ECR_REPOSITORY:latest" .

    # Tag for ECR
    docker tag "$ECR_REPOSITORY:latest" "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest"

    # Push to ECR
    docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest"

    log_success "Image pushed to ECR: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest"

    cd ../..
}

# Create IAM roles and policies
create_iam_resources() {
    log_info "Creating IAM resources..."

    # ECS task execution role
    ECS_EXECUTION_ROLE_ARN=$(aws iam get-role --role-name "ecsTaskExecutionRole" --query 'Role.Arn' --output text 2>/dev/null || echo "")

    if [ -z "$ECS_EXECUTION_ROLE_ARN" ]; then
        log_info "Creating ECS task execution role..."
        aws iam create-role \
            --role-name "ecsTaskExecutionRole" \
            --assume-role-policy-document file://iam/ecs-task-execution-trust-policy.json

        aws iam attach-role-policy \
            --role-name "ecsTaskExecutionRole" \
            --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    fi

    log_success "IAM resources ready"
}

# Create VPC and networking
create_networking() {
    log_info "Setting up networking..."

    # Create VPC if it doesn't exist
    VPC_ID=$(aws ec2 describe-vpcs --filters Name=tag:Name,Values="$PROJECT_NAME-vpc" --query 'Vpcs[0].VpcId' --output text 2>/dev/null || echo "")

    if [ -z "$VPC_ID" ]; then
        log_info "Creating VPC..."
        VPC_ID=$(aws ec2 create-vpc \
            --cidr-block "10.0.0.0/16" \
            --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$PROJECT_NAME-vpc}]" \
            --query 'Vpc.VpcId' \
            --output text)

        # Enable DNS hostnames
        aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames

        # Create subnets
        PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
            --vpc-id "$VPC_ID" \
            --cidr-block "10.0.1.0/24" \
            --availability-zone "${AWS_REGION}a" \
            --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$PROJECT_NAME-public-1}]" \
            --query 'Subnet.SubnetId' \
            --output text)

        PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
            --vpc-id "$VPC_ID" \
            --cidr-block "10.0.2.0/24" \
            --availability-zone "${AWS_REGION}b" \
            --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$PROJECT_NAME-public-2}]" \
            --query 'Subnet.SubnetId' \
            --output text)

        # Create internet gateway
        IGW_ID=$(aws ec2 create-internet-gateway \
            --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=$PROJECT_NAME-igw}]" \
            --query 'InternetGateway.InternetGatewayId' \
            --output text)

        aws ec2 attach-internet-gateway --vpc-id "$VPC_ID" --internet-gateway-id "$IGW_ID"

        # Create route table
        RT_ID=$(aws ec2 create-route-table \
            --vpc-id "$VPC_ID" \
            --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=$PROJECT_NAME-rt}]" \
            --query 'RouteTable.RouteTableId' \
            --output text)

        aws ec2 create-route --route-table-id "$RT_ID" --destination-cidr-block "0.0.0.0/0" --gateway-id "$IGW_ID"

        # Associate route table with subnets
        aws ec2 associate-route-table --route-table-id "$RT_ID" --subnet-id "$PUBLIC_SUBNET_1"
        aws ec2 associate-route-table --route-table-id "$RT_ID" --subnet-id "$PUBLIC_SUBNET_2"

        log_success "Created VPC and networking"
    else
        log_info "VPC already exists"
        # Get existing subnets
        PUBLIC_SUBNET_1=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" Name=tag:Name,Values="$PROJECT_NAME-public-1" --query 'Subnets[0].SubnetId' --output text)
        PUBLIC_SUBNET_2=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" Name=tag:Name,Values="$PROJECT_NAME-public-2" --query 'Subnets[0].SubnetId' --output text)
    fi

    # Save subnets for later use
    echo "$PUBLIC_SUBNET_1,$PUBLIC_SUBNET_2" > .subnets
}

# Create ECS cluster
create_ecs_cluster() {
    log_info "Creating ECS cluster..."

    if aws ecs describe-clusters --clusters "$ECS_CLUSTER" --query 'clusters[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
        log_info "ECS cluster already exists"
    else
        aws ecs create-cluster \
            --cluster-name "$ECS_CLUSTER" \
            --service-connect defaults \
            --capacity-providers FARGATE FARGATE_SPOT \
            --default-capacity-provider-strategy FARGATE
        log_success "Created ECS cluster: $ECS_CLUSTER"
    fi
}

# Create Application Load Balancer
create_load_balancer() {
    log_info "Creating Application Load Balancer..."

    SUBNETS=$(cat .subnets)

    if aws elbv2 describe-load-balancers --names "$LOAD_BALANCER" --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null; then
        log_info "Load balancer already exists"
    else
        # Create security group for load balancer
        LB_SG=$(aws ec2 create-security-group \
            --group-name "$PROJECT_NAME-lb-sg" \
            --description "Security group for SDLC load balancer" \
            --vpc-id "$VPC_ID" \
            --query 'GroupId' \
            --output text)

        # Allow HTTP traffic
        aws ec2 authorize-security-group-ingress \
            --group-id "$LB_SG" \
            --protocol tcp \
            --port 80 \
            --cidr 0.0.0.0/0

        # Allow HTTPS traffic
        aws ec2 authorize-security-group-ingress \
            --group-id "$LB_SG" \
            --protocol tcp \
            --port 443 \
            --cidr 0.0.0.0/0

        # Create load balancer
        LB_ARN=$(aws elbv2 create-load-balancer \
            --name "$LOAD_BALANCER" \
            --subnets $SUBNETS \
            --security-groups "$LB_SG" \
            --scheme internet-facing \
            --type application \
            --ip-address-type ipv4 \
            --query 'LoadBalancers[0].LoadBalancerArn' \
            --output text)

        # Create target group
        TG_ARN=$(aws elbv2 create-target-group \
            --name "$PROJECT_NAME-tg" \
            --protocol HTTP \
            --port 3000 \
            --vpc-id "$VPC_ID" \
            --target-type ip \
            --health-check-path '/api/health' \
            --health-check-interval-seconds 30 \
            --health-check-timeout-seconds 5 \
            --healthy-threshold-count 2 \
            --unhealthy-threshold-count 3 \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text)

        # Create listener
        aws elbv2 create-listener \
            --load-balancer-arn "$LB_ARN" \
            --protocol HTTP \
            --port 80 \
            --default-actions Type=forward,TargetGroupArn="$TG_ARN"

        log_success "Created load balancer: $LOAD_BALANCER"
    fi
}

# Create ECS task definition
create_task_definition() {
    log_info "Creating ECS task definition..."

    CPU=1024
    MEMORY=2048

    cat > task-definition.json << EOF
{
  "family": "$PROJECT_NAME",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "$CPU",
  "memory": "$MEMORY",
  "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "$PROJECT_NAME",
      "image": "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:sdlc/openai-api-key"
        },
        {
          "name": "ANTHROPIC_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:sdlc/anthropic-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$PROJECT_NAME",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

    aws ecs register-task-definition --cli-input-json file://task-definition.json
    log_success "Created ECS task definition"
}

# Create ECS service
create_ecs_service() {
    log_info "Creating ECS service..."

    SUBNETS=$(cat .subnets)

    # Get target group ARN
    TG_ARN=$(aws elbv2 describe-target-groups --names "$PROJECT_NAME-tg" --query 'TargetGroups[0].TargetGroupArn' --output text)

    # Create service
    aws ecs create-service \
        --cluster "$ECS_CLUSTER" \
        --service-name "$ECS_SERVICE" \
        --task-definition "$PROJECT_NAME" \
        --desired-count 2 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[],assignPublicIp=ENABLED}" \
        --load-balancers "targetGroupArn=$TG_ARN,containerName=$PROJECT_NAME,containerPort=3000" \
        --health-check-grace-period-seconds 60 \
        --deployment-configuration "maximumPercent=200,minimumHealthyPercent=50"

    log_success "Created ECS service"
}

# Create CloudWatch alarm for monitoring
create_monitoring() {
    log_info "Setting up monitoring..."

    # Create CloudWatch log group
    aws logs create-log-group --log-group-name "/ecs/$PROJECT_NAME" 2>/dev/null || true

    # Create CloudWatch alarm for high CPU usage
    aws cloudwatch put-metric-alarm \
        --alarm-name "$PROJECT_NAME-high-cpu" \
        --alarm-description "High CPU usage for $PROJECT_NAME" \
        --metric-name CPUUtilization \
        --namespace AWS/ECS \
        --statistic Average \
        --period 300 \
        --threshold 80 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2

    # Create CloudWatch alarm for high memory usage
    aws cloudwatch put-metric-alarm \
        --alarm-name "$PROJECT_NAME-high-memory" \
        --alarm-description "High memory usage for $PROJECT_NAME" \
        --metric-name MemoryUtilization \
        --namespace AWS/ECS \
        --statistic Average \
        --period 300 \
        --threshold 80 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2

    log_success "Monitoring configured"
}

# Store secrets in AWS Secrets Manager
store_secrets() {
    log_info "Configuring secrets..."

    # Prompt for API keys
    echo ""
    log_warning "Please enter your AI provider API keys:"
    echo "(Press Enter to skip any key)"
    echo ""

    read -p "OpenAI API Key: " OPENAI_KEY
    if [ ! -z "$OPENAI_KEY" ]; then
        aws secretsmanager create-secret \
            --name "sdlc/openai-api-key" \
            --secret-string "$OPENAI_KEY" \
            --description "OpenAI API key for SDLC platform" 2>/dev/null || \
        aws secretsmanager update-secret \
            --secret-id "sdlc/openai-api-key" \
            --secret-string "$OPENAI_KEY"
        log_success "OpenAI API key stored"
    fi

    read -p "Anthropic API Key: " ANTHROPIC_KEY
    if [ ! -z "$ANTHROPIC_KEY" ]; then
        aws secretsmanager create-secret \
            --name "sdlc/anthropic-api-key" \
            --secret-string "$ANTHROPIC_KEY" \
            --description "Anthropic API key for SDLC platform" 2>/dev/null || \
        aws secretsmanager update-secret \
            --secret-id "sdlc/anthropic-api-key" \
            --secret-string "$ANTHROPIC_KEY"
        log_success "Anthropic API key stored"
    fi

    read -p "AWS Bedrock Access Key: " BEDROCK_KEY
    if [ ! -z "$BEDROCK_KEY" ]; then
        aws secretsmanager create-secret \
            --name "sdlc/bedrock-access-key" \
            --secret-string "$BEDROCK_KEY" \
            --description "AWS Bedrock access key for SDLC platform" 2>/dev/null || \
        aws secretsmanager update-secret \
            --secret-id "sdlc/bedrock-access-key" \
            --secret-string "$BEDROCK_KEY"
        log_success "Bedrock access key stored"
    fi
}

# Wait for service to be stable
wait_for_deployment() {
    log_info "Waiting for service deployment..."

    # Wait for service to be stable
    aws ecs wait services-stable \
        --cluster "$ECS_CLUSTER" \
        --services "$ECS_SERVICE"

    # Get load balancer DNS name
    LB_DNS=$(aws elbv2 describe-load-balancers \
        --names "$LOAD_BALANCER" \
        --query 'LoadBalancers[0].DNSName' \
        --output text)

    # Test health endpoint
    log_info "Testing health endpoint..."
    for i in {1..30}; do
        if curl -s "http://$LB_DNS/api/health" | grep -q "healthy"; then
            log_success "Service is healthy and responding!"
            break
        fi
        echo "Attempt $i/30 - Waiting for service to be healthy..."
        sleep 10
    done
}

# Create database (DynamoDB for audit logs)
create_database() {
    log_info "Creating DynamoDB table for audit logs..."

    if aws dynamodb describe-table --table-name "$PROJECT_NAME-audit-logs" --query 'Table.TableStatus' --output text 2>/dev/null | grep -q "ACTIVE"; then
        log_info "DynamoDB table already exists"
    else
        aws dynamodb create-table \
            --table-name "$PROJECT_NAME-audit-logs" \
            --attribute-definitions \
                AttributeName=transactionId,AttributeType=S \
                AttributeName=timestamp,AttributeType=S \
            --key-schema \
                AttributeName=transactionId,KeyType=HASH \
                AttributeName=timestamp,KeyType=RANGE \
            --billing-mode PAY_PER_REQUEST \
            --global-secondary-indexes \
                '[
                    {
                        "IndexName": "UserIndex",
                        "KeySchema": [
                            {"AttributeName":"userId","KeyType":"HASH"},
                            {"AttributeName":"timestamp","KeyType":"RANGE"}
                        ],
                        "Projection":{"ProjectionType":"ALL"}
                    }
                ]'

        # Wait for table creation
        aws dynamodb wait table-exists --table-name "$PROJECT_NAME-audit-logs"
        log_success "Created DynamoDB table"
    fi
}

# Print success message
print_success() {
    echo ""
    echo "🎉 SDLC Compliance Platform deployed to AWS successfully!"
    echo "======================================================="
    echo ""

    # Get load balancer DNS name
    LB_DNS=$(aws elbv2 describe-load-balancers \
        --names "$LOAD_BALANCER" \
        --query 'LoadBalancers[0].DNSName' \
        --output text)

    echo "🌐 Platform URL: http://$LB_DNS"
    echo "📊 Health Check: http://$LB_DNS/api/health"
    echo "🏗️  ECS Cluster: $ECS_CLUSTER"
    echo "📦 ECR Repository: $ECR_REPOSITORY"
    echo ""
    echo "🔧 Next Steps:"
    echo "1. Test the health endpoint: curl http://$LB_DNS/api/health"
    echo "2. Configure your applications to use: http://$LB_DNS"
    echo "3. Monitor service in AWS Console > ECS > $ECS_CLUSTER"
    echo "4. Check logs in CloudWatch: /ecs/$PROJECT_NAME"
    echo "5. Set up custom domain in Route 53 (optional)"
    echo ""
    echo "📖 Quick Integration Example:"
    echo "curl -X POST http://$LB_DNS/v1/chat/completions \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -H 'X-Data-Classification: phi' \\"
    echo "  -d '{\"provider\": \"openai\", \"messages\": [{\"role\": \"user\", \"content\": \"Test\"}]}'"
    echo ""
    echo "🛡️ Your enterprise AI compliance platform is running on AWS!"
}

# Main execution
main() {
    check_aws_cli
    create_ecr_repository
    build_and_push_image
    create_iam_resources
    create_networking
    create_ecs_cluster
    create_load_balancer
    create_database
    create_task_definition
    create_ecs_service
    create_monitoring
    store_secrets
    wait_for_deployment
    print_success

    echo ""
    log_info "AWS deployment complete! 🚀"
}

# Handle script arguments
case "${1:-}" in
    "--help"|"-h")
        echo "SDLC Compliance Platform - AWS ECS Deployment"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --region       Set AWS region (default: us-east-1)"
        echo "  --skip-build   Skip Docker build and push"
        echo "  --monitoring-only  Set up monitoring only"
        echo ""
        exit 0
        ;;
    "--region")
        AWS_REGION="$2"
        shift 2
        main
        ;;
    "--skip-build")
        log_info "Skipping Docker build..."
        check_aws_cli
        create_iam_resources
        create_networking
        create_ecs_cluster
        create_load_balancer
        create_database
        create_task_definition
        create_ecs_service
        create_monitoring
        store_secrets
        wait_for_deployment
        print_success
        ;;
    "--monitoring-only")
        log_info "Setting up monitoring only..."
        check_aws_cli
        create_monitoring
        log_success "Monitoring configured"
        ;;
    *)
        main
        ;;
esac