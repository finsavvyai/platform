#!/bin/bash

# Cloudflare Queues Setup Script
# This script provisions queues for asynchronous processing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Queue configuration
QUEUES=(
    "fintech-billing-queue:Billing and payment processing tasks"
    "fintech-compliance-queue:Compliance screening and monitoring tasks"
    "fintech-intelligence-queue:Financial intelligence and analytics tasks"
    "fintech-risk-queue:Risk assessment and investigation tasks"
    "fintech-notification-queue:Notification and communication tasks"
)

echo -e "${BLUE}📋 Setting up Cloudflare Queues for FinTech Suite...${NC}"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it with: npm install -g wrangler${NC}"
    exit 1
fi

# Function to create queue if it doesn't exist
create_queue() {
    local queue_name="$1"
    local queue_description="$2"

    echo -e "${YELLOW}📋 Creating queue: ${queue_name}${NC}"

    # Create the queue
    wrangler queues create "${queue_name}" || {
        echo -e "${RED}❌ Failed to create queue ${queue_name}${NC}"
        return 1
    }

    echo -e "${GREEN}✅ Successfully created queue: ${queue_name}${NC}"
    echo -e "   ${queue_description}"
    echo ""
}

# Create all queues
for queue_info in "${QUEUES[@]}"; do
    IFS=':' read -r queue_name queue_description <<< "$queue_info"
    create_queue "$queue_name" "$queue_description"
done

# List all queues after creation
echo -e "${BLUE}📋 Current queues:${NC}"
wrangler queues list

echo -e "${GREEN}🎉 Queue setup completed!${NC}"
echo -e "${YELLOW}📝 Note: Update your wrangler.toml with the correct queue configurations.${NC}"

# Create queue message schemas
echo -e "${BLUE}📚 Creating queue message schemas...${NC}"

cat > infrastructure/queue-schemas.md << 'EOF'
# Queue Message Schemas

## Billing Queue (fintech-billing-queue)

**Purpose**: Asynchronous billing and payment processing
**Retries**: 3 with exponential backoff
**Dead Letter Queue**: billing-dlq

**Message Schema**:
```json
{
  "message_id": "string",
  "event_type": "invoice_created|payment_processed|subscription_renewed|payment_failed",
  "organization_id": "string",
  "user_id": "string",
  "data": {
    "invoice_id": "string",
    "payment_id": "string",
    "amount_cents": "integer",
    "currency": "string",
    "timestamp": "ISO 8601 date",
    "metadata": "object"
  },
  "priority": "high|medium|low",
  "retry_count": "integer",
  "created_at": "ISO 8601 date"
}
```

## Compliance Queue (fintech-compliance-queue)

**Purpose**: Compliance screening and monitoring tasks
**Retries**: 5 with exponential backoff
**Dead Letter Queue**: compliance-dlq

**Message Schema**:
```json
{
  "message_id": "string",
  "event_type": "kyc_submission|sanctions_screening|case_created|alert_triggered",
  "organization_id": "string",
  "customer_id": "string",
  "data": {
    "screening_id": "string",
    "customer_data": "object",
    "screening_type": "individual|business|beneficial_owners",
    "urgency": "high|medium|low",
    "timestamp": "ISO 8601 date",
    "metadata": "object"
  },
  "priority": "high|medium|low",
  "retry_count": "integer",
  "created_at": "ISO 8601 date"
}
```

## Intelligence Queue (fintech-intelligence-queue)

**Purpose**: Financial intelligence and analytics processing
**Retries**: 2 with exponential backoff
**Dead Letter Queue**: intelligence-dlq

**Message Schema**:
```json
{
  "message_id": "string",
  "event_type": "data_import|categorization|forecasting|report_generation",
  "organization_id": "string",
  "data": {
    "task_id": "string",
    "task_type": "transaction_categorization|cash_flow_forecast|risk_assessment",
    "input_data": "object",
    "parameters": "object",
    "timestamp": "ISO 8601 date",
    "metadata": "object"
  },
  "priority": "medium|low",
  "retry_count": "integer",
  "created_at": "ISO 8601 date"
}
```

## Risk Queue (fintech-risk-queue)

**Purpose**: Risk assessment and investigation tasks
**Retries**: 3 with exponential backoff
**Dead Letter Queue**: risk-dlq

**Message Schema**:
```json
{
  "message_id": "string",
  "event_type": "risk_assessment|fraud_detection|case_investigation|alert_processing",
  "organization_id": "string",
  "data": {
    "event_id": "string",
    "risk_type": "transaction_fraud|aml_flag|unusual_activity",
    "event_data": "object",
    "urgency": "critical|high|medium|low",
    "timestamp": "ISO 8601 date",
    "metadata": "object"
  },
  "priority": "critical|high|medium|low",
  "retry_count": "integer",
  "created_at": "ISO 8601 date"
}
```

## Notification Queue (fintech-notification-queue)

**Purpose**: Notifications and communications
**Retries**: 5 with exponential backoff
**Dead Letter Queue**: notification-dlq

**Message Schema**:
```json
{
  "message_id": "string",
  "event_type": "email_sent|sms_sent|push_notification|in_app_notification",
  "organization_id": "string",
  "recipient_id": "string",
  "data": {
    "notification_type": "invoice_sent|payment_received|compliance_alert|risk_alert",
    "subject": "string",
    "content": "string",
    "channels": ["email", "sms", "push", "in_app"],
    "template_id": "string",
    "template_data": "object",
    "timestamp": "ISO 8601 date",
    "metadata": "object"
  },
  "priority": "high|medium|low",
  "retry_count": "integer",
  "created_at": "ISO 8601 date"
}
```

## Queue Configuration

### Dead Letter Queues
Each queue has a corresponding dead letter queue (DLQ) for failed messages:
- `billing-dlq`
- `compliance-dlq`
- `intelligence-dlq`
- `risk-dlq`
- `notification-dlq`

### Retry Policies
- **Billing**: 3 retries (financial operations require reliability)
- **Compliance**: 5 retries (regulatory requirements)
- **Intelligence**: 2 retries (analytics can be regenerated)
- **Risk**: 3 retries (security operations)
- **Notifications**: 5 retries (user experience critical)

### Priority Levels
- **Critical**: Immediate processing (security alerts, high-risk activities)
- **High**: Process within 1 minute (payment failures, compliance alerts)
- **Medium**: Process within 5 minutes (reports, analytics)
- **Low**: Process within 30 minutes (batch operations, maintenance)

### Monitoring and Alerting
- Queue depth monitoring
- Processing latency tracking
- Error rate monitoring
- Dead letter queue alerting
- Consumer health checks
EOF

echo -e "${GREEN}✅ Queue schema documentation created: infrastructure/queue-schemas.md${NC}"
