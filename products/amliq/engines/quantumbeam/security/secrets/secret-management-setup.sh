#!/bin/bash
# Secret Management Setup Script
# Sets up AWS Secrets Manager for QuantumBeam

set -euo pipefail

# Configuration
REGION="${AWS_REGION:-us-east-1}"
NAMESPACE="quantumbeam"
PROJECT="quantumbeam"

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
        log_error "AWS CLI is not installed. Please install it first."
        echo "Installation guide: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi

    # Check if AWS credentials are configured
    if ! aws sts get-caller-identity --region "$REGION" &> /dev/null; then
        log_error "AWS credentials are not configured or are invalid."
        echo "Please configure AWS credentials using 'aws configure' or environment variables."
        exit 1
    }

    log_success "AWS CLI is properly configured"
}

# Generate random secure values
generate_secure_value() {
    local length=${1:-32}
    openssl rand -base64 "$length" | tr -d "=+/" | cut -c1-"$length"
}

# Create a secret in AWS Secrets Manager
create_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local description="$3"
    local secret_type="$4"

    log_info "Creating secret: $secret_name"

    aws secretsmanager create-secret \
        --name "$secret_name" \
        --description "$description" \
        --secret-string "$secret_value" \
        --region "$REGION" \
        --tags Key=Project,Value="$PROJECT" Key=Namespace,Value="$NAMESPACE" Key=Type,Value="$secret_type" \
        --output json

    log_success "Secret '$secret_name' created successfully"
}

# Update an existing secret
update_secret() {
    local secret_name="$1"
    local secret_value="$2"

    log_info "Updating secret: $secret_name"

    aws secretsmanager update-secret \
        --secret-id "$secret_name" \
        --secret-string "$secret_value" \
        --region "$REGION" \
        --output json

    log_success "Secret '$secret_name' updated successfully"
}

# Check if secret exists
secret_exists() {
    local secret_name="$1"

    aws secretsmanager describe-secret \
        --secret-id "$secret_name" \
        --region "$REGION" \
        --query 'Name' \
        --output text 2>/dev/null || false
}

# Setup database secrets
setup_database_secrets() {
    log_info "Setting up database secrets..."

    local db_password
    db_password=$(generate_secure_value 32)

    local secret_name="${PROJECT}/database/credentials"
    local secret_value=$(cat <<EOF
{
  "username": "quantumbeam",
  "password": "${db_password}",
  "host": "postgres.quantumbeam.local",
  "port": "5432",
  "database": "quantumbeam",
  "sslmode": "require"
}
EOF
)

    if secret_exists "$secret_name"; then
        log_warn "Database secret already exists, updating..."
        update_secret "$secret_name" "$secret_value"
    else
        create_secret "$secret_name" "$secret_value" "QuantumBeam Database Credentials" "database"
    fi
}

# Setup Redis secrets
setup_redis_secrets() {
    log_info "Setting up Redis secrets..."

    local redis_password
    redis_password=$(generate_secure_value 24)

    local secret_name="${PROJECT}/redis/credentials"
    local secret_value=$(cat <<EOF
{
  "password": "${redis_password}",
  "host": "redis.quantumbeam.local",
  "port": "6379",
  "database": "0"
}
EOF
)

    if secret_exists "$secret_name"; then
        log_warn "Redis secret already exists, updating..."
        update_secret "$secret_name" "$secret_value"
    else
        create_secret "$secret_name" "$secret_value" "QuantumBeam Redis Credentials" "database"
    fi
}

# Setup JWT secrets
setup_jwt_secrets() {
    log_info "Setting up JWT secrets..."

    local jwt_secret
    jwt_secret=$(generate_secure_value 64)

    local secret_name="${PROJECT}/auth/jwt-secret"
    local secret_value=$(cat <<EOF
{
  "secret": "${jwt_secret}",
  "algorithm": "HS256",
  "expiry": "24h",
  "refresh_expiry": "168h"
}
EOF
)

    if secret_exists "$secret_name"; then
        log_warn "JWT secret already exists, updating..."
        update_secret "$secret_name" "$secret_value"
    else
        create_secret "$secret_name" "$secret_value" "QuantumBeam JWT Signing Secret" "jwt"
    fi
}

# Setup API keys
setup_api_keys() {
    log_info "Setting up API keys..."

    local api_key
    api_key=$(generate_secure_value 64)

    local secret_name="${PROJECT}/external/api-keys"
    local secret_value=$(cat <<EOF
{
  "openai": "$(generate_secure_value 64)",
  "anthropic": "$(generate_secure_value 64)",
  "huggingface": "$(generate_secure_value 64)",
  "lemon_squeezy": "$(generate_secure_value 64)",
  "internal_api_key": "${api_key}"
}
EOF
)

    if secret_exists "$secret_name"; then
        log_warn "API keys secret already exists, updating..."
        update_secret "$secret_name" "$secret_value"
    else
        create_secret "$secret_name" "$secret_value" "QuantumBeam External API Keys" "api_key"
    fi
}

# Setup encryption keys
setup_encryption_keys() {
    log_info "Setting up encryption keys..."

    local encryption_key
    encryption_key=$(generate_secure_value 32)

    local secret_name="${PROJECT}/encryption/keys"
    local secret_value=$(cat <<EOF
{
  "primary_key": "${encryption_key}",
  "key_id": "key-$(date +%Y%m%d-%H%M%S)",
  "algorithm": "AES-256-GCM",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

    if secret_exists "$secret_name"; then
        log_warn "Encryption keys secret already exists, updating..."
        update_secret "$secret_name" "$secret_value"
    else
        create_secret "$secret_name" "$secret_value" "QuantumBeam Encryption Keys" "encryption"
    fi
}

# Setup service configuration
setup_service_config() {
    log_info "Setting up service configuration..."

    local secret_name="${PROJECT}/config/services"
    local secret_value=$(cat <<EOF
{
  "ai_ml_service": {
    "endpoint": "http://ai-ml.quantumbeam.local:8001",
    "timeout": "30s",
    "retry_attempts": 3
  },
  "quantum_service": {
    "endpoint": "http://quantum.quantumbeam.local:8002",
    "timeout": "45s",
    "retry_attempts": 3
  },
  "monitoring": {
    "prometheus_endpoint": "http://prometheus.quantumbeam.local:9090",
    "alertmanager_endpoint": "http://alertmanager.quantumbeam.local:9093"
  }
}
EOF
)

    if secret_exists "$secret_name"; then
        log_warn "Service config secret already exists, updating..."
        update_secret "$secret_name" "$secret_value"
    else
        create_secret "$secret_name" "$secret_value" "QuantumBeam Service Configuration" "service_config"
    fi
}

# Setup rotation configuration
setup_rotation_config() {
    log_info "Setting up rotation configuration..."

    local secret_name="${PROJECT}/config/rotation"
    local secret_value=$(cat <<EOF
{
  "database_credentials": {
    "rotation_interval": "90d",
    "rotation_strategy": "scheduled",
    "auto_rotate": true
  },
  "jwt_secret": {
    "rotation_interval": "60d",
    "rotation_strategy": "scheduled",
    "auto_rotate": true
  },
  "api_keys": {
    "rotation_interval": "30d",
    "rotation_strategy": "scheduled",
    "auto_rotate": true
  },
  "encryption_keys": {
    "rotation_interval": "180d",
    "rotation_strategy": "scheduled",
    "auto_rotate": true
  }
}
EOF
)

    if secret_exists "$secret_name"; then
        log_warn "Rotation config secret already exists, updating..."
        update_secret "$secret_name" "$secret_value"
    else
        create_secret "$secret_name" "$secret_value" "QuantumBeam Secret Rotation Configuration" "config"
    fi
}

# Create IAM policies for secret access
create_iam_policies() {
    log_info "Creating IAM policies for secret access..."

    local policy_name="${PROJECT}-secrets-access"
    local policy_file="/tmp/${PROJECT}-secrets-policy.json"

    cat > "$policy_file" << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret"
            ],
            "Resource": "arn:aws:secretsmanager:${REGION}:*:*:${PROJECT}/*",
            "Condition": {
                "StringEquals": {
                    "secretsmanager:ResourceTag/Project": "$PROJECT"
                }
            }
        },
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:ListSecrets"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "secretsmanager:ResourceTag/Project": "$PROJECT"
                }
            }
        }
    ]
}
EOF

    # Create or update the policy
    if aws iam get-policy --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/${policy_name}" --region "$REGION" &>/dev/null; then
        log_warn "IAM policy '$policy_name' already exists"
    else
        aws iam create-policy \
            --policy-name "$policy_name" \
            --policy-document "file://$policy_file" \
            --region "$REGION" \
            --description "IAM policy for QuantumBeam secret access"

        log_success "IAM policy '$policy_name' created successfully"
    fi

    # Clean up
    rm -f "$policy_file"
}

# Setup CloudWatch logging for secret access
setup_cloudwatch_logging() {
    log_info "Setting up CloudWatch logging for secret access..."

    local log_group_name="/aws/secretsmanager/${PROJECT}"
    local retention_days=30

    # Create log group if it doesn't exist
    if ! aws logs describe-log-groups --log-group-name-prefix "$log_group_name" --region "$REGION" --query 'logGroups[?logGroupName==`'${log_group_name}'`].logGroupName' --output text 2>/dev/null | grep -q "$log_group_name"; then
        aws logs create-log-group \
            --log-group-name "$log_group_name" \
            --region "$REGION"

        aws logs put-retention-policy \
            --log-group-name "$log_group_name" \
            --retention-in-days "$retention_days" \
            --region "$REGION"

        log_success "CloudWatch log group '$log_group_name' created with ${retention_days} days retention"
    else
        log_warn "CloudWatch log group '$log_group_name' already exists"
    fi
}

# Generate environment file template
generate_env_template() {
    log_info "Generating environment file template..."

    local env_file=".env.secrets.template"
    local account_id
    account_id=$(aws sts get-caller-identity --query Account --output text)

    cat > "$env_file" << EOF
# QuantumBeam Environment Variables Template
# This file contains references to AWS Secrets Manager secrets
# Use this template to configure your application

# Database Configuration
DATABASE_URL=postgresql://\${aws:secretsmanager:${PROJECT}/database/credentials:username}:\${aws:secretsmanager:${PROJECT}/database/credentials:password}@postgres.quantumbeam.local:5432/quantumbeam?sslmode=require
DB_HOST=\${aws:secretsmanager:${PROJECT}/database/credentials:host}
DB_PORT=\${aws:secretsmanager:${PROJECT}/database:credentials:port}
DB_NAME=\${aws:secretsmanager:${PROJECT}/database:credentials:database}
DB_USER=\${aws:secretsmanager:${PROJECT}/database:credentials:username}

# Redis Configuration
REDIS_URL=redis://:\${aws:secretsmanager:${PROJECT}/redis/credentials:password}@redis.quantumbeam.local:6379/0
REDIS_HOST=\${aws:secretsmanager:${PROJECT}/redis/credentials:host}
REDIS_PORT=\${aws:secretsmanager:${PROJECT}/redis:credentials:port}
REDIS_PASSWORD=\${aws:secretsmanager:${PROJECT}/redis/credentials:password}

# JWT Configuration
JWT_SECRET=\${aws:secretsmanager:${PROJECT}/auth/jwt-secret:secret}
JWT_ALGORITHM=\${aws:secretsmanager:${PROJECT}/auth/jwt-secret:algorithm}
JWT_EXPIRY=\${aws:secretsmanager:${PROJECT}/auth/jwt-secret:expiry}

# External API Keys
OPENAI_API_KEY=\${aws:secretsmanager:${PROJECT}/external/api-keys:openai}
ANTHROPIC_API_KEY=\${aws:secretsmanager:${PROJECT}/external/api-keys:anthropic}
HUGGINGFACE_TOKEN=\${aws:secretsmanager:${PROJECT}/external/api-keys:huggingface}
LEMONSQUEEZY_API_KEY=\${aws:secretsmanager:${PROJECT}/external/api-keys:lemon_squeezy}

# Encryption
ENCRYPTION_KEY=\${aws:secretsmanager:${PROJECT}/encryption/keys:primary_key}

# Service Endpoints
AI_SERVICE_URL=\${aws:secretsmanager:${PROJECT}/config/services:ai_ml_service.endpoint}
QUANTUM_SERVICE_URL=\${aws:secretsmanager:${PROJECT}/config/services:quantum_service.endpoint}

# AWS Configuration
AWS_REGION=${REGION}
AWS_ACCOUNT_ID=${account_id}

# Secrets Manager Configuration
SECRETS_MANAGER_PROVIDER=aws
SECRETS_MANAGER_REGION=${REGION}
SECRETS_CACHE_TTL=5m
SECRET_ROTATION_ENABLED=true
EOF

    log_success "Environment template generated: $env_file"
    log_warn "Review and customize the template for your environment"
}

# Main execution
main() {
    log_info "Starting QuantumBeam secret management setup..."

    check_aws_cli

    # Create all secrets
    setup_database_secrets
    setup_redis_secrets
    setup_jwt_secrets
    setup_api_keys
    setup_encryption_keys
    setup_service_config
    setup_rotation_config

    # Setup supporting infrastructure
    create_iam_policies
    setup_cloudwatch_logging
    generate_env_template

    log_success "QuantumBeam secret management setup completed successfully!"
    log_info "Next steps:"
    echo "1. Review the generated environment template: .env.secrets.template"
    echo "2. Attach the IAM policy '${PROJECT}-secrets-access' to your EC2 instances/EKS roles"
    echo "3. Configure your applications to use AWS Secrets Manager"
    echo "4. Set up secret rotation schedules in AWS Secrets Manager"
    echo "5. Monitor secret access through CloudWatch logs"
}

# Execute main function
main "$@"