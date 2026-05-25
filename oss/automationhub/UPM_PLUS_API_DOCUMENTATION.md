# UPM.Plus API Documentation

## Overview

The UPM.Plus API provides programmatic access to all platform features including workflow management, agent coordination, browser automation, infrastructure management, and AI assistance.

**Base URL**: `https://api.upmplus.com/v1`
**Authentication**: JWT Bearer Token
**Content Type**: `application/json`

## Authentication

### Get Access Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_token_here"
}
```

### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "your_refresh_token"
}
```

## Workflows API

### List Workflows

```http
GET /workflows
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `status` (string): Filter by status (`active`, `paused`, `completed`)
- `category` (string): Filter by category

**Response:**
```json
{
  "workflows": [
    {
      "id": "wf_123456789",
      "name": "Data Collection Workflow",
      "description": "Automated web scraping and data processing",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T14:22:00Z",
      "steps_count": 5,
      "success_rate": 0.95,
      "last_execution": "2024-01-15T14:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### Create Workflow

```http
POST /workflows
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "E-commerce Data Scraper",
  "description": "Scrape product data from multiple e-commerce sites",
  "category": "data_collection",
  "steps": [
    {
      "id": "step_1",
      "type": "browser_action",
      "name": "Navigate to Site",
      "config": {
        "action": "navigate",
        "url": "https://example-store.com/products",
        "wait_for": "networkidle"
      }
    },
    {
      "id": "step_2", 
      "type": "data_extraction",
      "name": "Extract Product Data",
      "config": {
        "selector": ".product-item",
        "fields": {
          "name": ".product-name",
          "price": ".price",
          "rating": ".rating",
          "availability": ".stock-status"
        },
        "pagination": {
          "enabled": true,
          "next_button": ".next-page"
        }
      },
      "depends_on": ["step_1"]
    },
    {
      "id": "step_3",
      "type": "data_processing",
      "name": "Clean and Validate Data",
      "config": {
        "transformations": [
          {"field": "price", "type": "currency_to_float"},
          {"field": "rating", "type": "string_to_float"},
          {"field": "name", "type": "trim_whitespace"}
        ],
        "validation": {
          "required_fields": ["name", "price"],
          "price_range": {"min": 0, "max": 10000}
        }
      },
      "depends_on": ["step_2"]
    }
  ],
  "schedule": {
    "enabled": true,
    "cron": "0 */6 * * *",
    "timezone": "UTC"
  },
  "error_handling": {
    "retry_policy": {
      "max_attempts": 3,
      "backoff_strategy": "exponential"
    },
    "notification": {
      "on_failure": ["email", "slack"],
      "recipients": ["admin@company.com"]
    }
  }
}
```

**Response:**
```json
{
  "id": "wf_987654321",
  "name": "E-commerce Data Scraper",
  "status": "created",
  "created_at": "2024-01-15T15:30:00Z",
  "validation": {
    "valid": true,
    "warnings": [
      "Consider adding rate limiting for better site compatibility"
    ]
  }
}
```

### Execute Workflow

```http
POST /workflows/{workflow_id}/execute
Authorization: Bearer {token}
Content-Type: application/json

{
  "input_data": {
    "target_urls": [
      "https://store1.com/products",
      "https://store2.com/products"
    ],
    "output_format": "json",
    "max_products": 1000
  },
  "execution_options": {
    "priority": "high",
    "timeout": 3600,
    "parallel_browsers": 3
  }
}
```

**Response:**
```json
{
  "execution_id": "exec_456789123",
  "workflow_id": "wf_987654321",
  "status": "running",
  "started_at": "2024-01-15T16:00:00Z",
  "estimated_completion": "2024-01-15T16:45:00Z",
  "progress": {
    "current_step": 1,
    "total_steps": 3,
    "percentage": 33
  }
}
```

### Get Workflow Execution Status

```http
GET /workflows/{workflow_id}/executions/{execution_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "execution_id": "exec_456789123",
  "workflow_id": "wf_987654321",
  "status": "completed",
  "started_at": "2024-01-15T16:00:00Z",
  "completed_at": "2024-01-15T16:42:00Z",
  "duration": 2520,
  "steps": [
    {
      "step_id": "step_1",
      "status": "completed",
      "duration": 45,
      "output": {
        "pages_loaded": 2,
        "load_time": "2.3s"
      }
    },
    {
      "step_id": "step_2", 
      "status": "completed",
      "duration": 2400,
      "output": {
        "products_extracted": 847,
        "pages_processed": 12
      }
    },
    {
      "step_id": "step_3",
      "status": "completed", 
      "duration": 75,
      "output": {
        "products_validated": 847,
        "invalid_records": 0
      }
    }
  ],
  "result": {
    "total_products": 847,
    "output_file": "https://storage.upmplus.com/results/exec_456789123.json",
    "summary": {
      "unique_products": 847,
      "average_price": 45.67,
      "price_range": {"min": 5.99, "max": 299.99}
    }
  }
}
```

## Agents API

### List Agents

```http
GET /agents
Authorization: Bearer {token}
```

**Query Parameters:**
- `type` (string): Filter by agent type (`browser`, `infrastructure`, `conversational`, `data`)
- `status` (string): Filter by status (`active`, `idle`, `busy`, `offline`)

**Response:**
```json
{
  "agents": [
    {
      "id": "agent_123456",
      "name": "Web Scraper Pro",
      "type": "browser",
      "status": "active",
      "capabilities": [
        "web_scraping",
        "form_filling", 
        "screenshot_capture",
        "pdf_generation"
      ],
      "current_task": {
        "workflow_id": "wf_987654321",
        "step_id": "step_2",
        "started_at": "2024-01-15T16:15:00Z"
      },
      "performance": {
        "success_rate": 0.98,
        "average_response_time": 2.3,
        "tasks_completed": 1247
      }
    }
  ]
}
```

### Create Agent

```http
POST /agents
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Custom Data Processor",
  "type": "data",
  "description": "Specialized agent for financial data processing",
  "capabilities": [
    "data_transformation",
    "statistical_analysis",
    "report_generation"
  ],
  "config": {
    "max_concurrent_tasks": 5,
    "memory_limit": "2GB",
    "timeout": 300,
    "tools": [
      "pandas",
      "numpy", 
      "matplotlib"
    ]
  },
  "specialization": {
    "domain": "finance",
    "data_types": ["csv", "json", "excel"],
    "output_formats": ["pdf", "html", "json"]
  }
}
```

### Assign Task to Agent

```http
POST /agents/{agent_id}/tasks
Authorization: Bearer {token}
Content-Type: application/json

{
  "task_type": "data_processing",
  "priority": "high",
  "input_data": {
    "source_file": "https://storage.upmplus.com/data/financial_data.csv",
    "processing_rules": [
      {"column": "amount", "operation": "currency_conversion", "target": "USD"},
      {"column": "date", "operation": "date_standardization", "format": "ISO8601"}
    ]
  },
  "output_requirements": {
    "format": "json",
    "destination": "https://webhook.site/unique-id"
  }
}
```

## Browser Automation API

### Create Browser Session

```http
POST /browser/sessions
Authorization: Bearer {token}
Content-Type: application/json

{
  "browser": "chrome",
  "headless": true,
  "viewport": {
    "width": 1920,
    "height": 1080
  },
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "proxy": {
    "enabled": false
  },
  "extensions": ["stealth", "adblocker"]
}
```

**Response:**
```json
{
  "session_id": "browser_session_789",
  "status": "ready",
  "browser_info": {
    "type": "chrome",
    "version": "120.0.6099.109",
    "headless": true
  },
  "created_at": "2024-01-15T16:30:00Z",
  "expires_at": "2024-01-15T17:30:00Z"
}
```

### Execute Browser Action

```http
POST /browser/sessions/{session_id}/actions
Authorization: Bearer {token}
Content-Type: application/json

{
  "action": "navigate",
  "parameters": {
    "url": "https://example.com",
    "wait_for": "networkidle",
    "timeout": 30000
  }
}
```

**Action Types:**
- `navigate`: Navigate to URL
- `click`: Click element
- `type`: Type text into element
- `scroll`: Scroll page or element
- `screenshot`: Take screenshot
- `extract`: Extract data from elements
- `wait`: Wait for condition

### Extract Data

```http
POST /browser/sessions/{session_id}/extract
Authorization: Bearer {token}
Content-Type: application/json

{
  "selectors": {
    "title": "h1.main-title",
    "price": ".price-display",
    "description": ".product-description",
    "images": {
      "selector": ".product-images img",
      "attribute": "src",
      "multiple": true
    }
  },
  "options": {
    "wait_for_elements": true,
    "timeout": 10000,
    "scroll_to_load": true
  }
}
```

**Response:**
```json
{
  "data": {
    "title": "Premium Wireless Headphones",
    "price": "$199.99",
    "description": "High-quality wireless headphones with noise cancellation...",
    "images": [
      "https://example.com/images/headphones-1.jpg",
      "https://example.com/images/headphones-2.jpg"
    ]
  },
  "metadata": {
    "extraction_time": "2024-01-15T16:35:00Z",
    "page_url": "https://example.com/product/123",
    "elements_found": 4
  }
}
```

## Infrastructure API

### List Infrastructure Resources

```http
GET /infrastructure/resources
Authorization: Bearer {token}
```

**Response:**
```json
{
  "resources": [
    {
      "id": "infra_server_001",
      "name": "Web Server 1",
      "type": "server",
      "provider": "aws",
      "region": "us-east-1",
      "status": "running",
      "specs": {
        "instance_type": "t3.medium",
        "cpu": 2,
        "memory": "4GB",
        "storage": "20GB SSD"
      },
      "monitoring": {
        "cpu_usage": 45.2,
        "memory_usage": 67.8,
        "disk_usage": 34.1,
        "network_in": "125 MB/s",
        "network_out": "89 MB/s"
      }
    }
  ]
}
```

### Execute Ansible Playbook

```http
POST /infrastructure/playbooks/execute
Authorization: Bearer {token}
Content-Type: application/json

{
  "playbook": "deploy-application.yml",
  "inventory": "production",
  "variables": {
    "app_version": "v2.1.0",
    "environment": "production",
    "database_url": "postgresql://prod-db:5432/app"
  },
  "options": {
    "check_mode": false,
    "verbose": 2,
    "timeout": 1800
  }
}
```

**Response:**
```json
{
  "execution_id": "playbook_exec_456",
  "status": "running",
  "started_at": "2024-01-15T17:00:00Z",
  "playbook": "deploy-application.yml",
  "targets": [
    "web-server-1",
    "web-server-2", 
    "web-server-3"
  ]
}
```

## AI Assistant API

### Chat with AI Assistant

```http
POST /ai/chat
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "How do I create a workflow that monitors my website for changes?",
  "context": {
    "current_page": "/workflows",
    "user_role": "developer",
    "recent_actions": [
      "viewed_workflow_list",
      "clicked_create_workflow"
    ]
  },
  "conversation_id": "conv_123456",
  "preferences": {
    "response_style": "detailed",
    "include_code_examples": true
  }
}
```

**Response:**
```json
{
  "response": "I'll help you create a website monitoring workflow. Based on your current context, I can see you're in the workflows section. Here's a step-by-step approach:\n\n1. **Create a new workflow** with these components:\n   - Browser automation to visit your website\n   - Content extraction to capture current state\n   - Comparison logic to detect changes\n   - Notification system for alerts\n\n2. **Here's a sample workflow configuration:**\n\n```json\n{\n  \"name\": \"Website Change Monitor\",\n  \"schedule\": \"0 */30 * * *\",\n  \"steps\": [\n    {\n      \"type\": \"browser_action\",\n      \"action\": \"navigate\",\n      \"url\": \"https://your-website.com\"\n    },\n    {\n      \"type\": \"extract_content\",\n      \"selector\": \"body\",\n      \"hash_content\": true\n    },\n    {\n      \"type\": \"compare_with_previous\",\n      \"threshold\": 0.05\n    },\n    {\n      \"type\": \"send_notification\",\n      \"condition\": \"changes_detected\",\n      \"channels\": [\"email\", \"slack\"]\n    }\n  ]\n}\n```\n\nWould you like me to help you set this up, or do you have specific requirements for what changes you want to monitor?",
  "suggestions": [
    "Create this workflow for me",
    "Show me more monitoring options",
    "How do I customize the change detection?",
    "What notification channels are available?"
  ],
  "conversation_id": "conv_123456",
  "response_id": "resp_789012"
}
```

### Upload Document to Knowledge Base

```http
POST /knowledge/documents
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: (binary data)
metadata: {
  "title": "API Integration Guide",
  "category": "documentation",
  "tags": ["api", "integration", "tutorial"],
  "access_level": "team"
}
```

### Search Knowledge Base

```http
GET /knowledge/search
Authorization: Bearer {token}
```

**Query Parameters:**
- `q` (string): Search query
- `category` (string): Filter by category
- `tags` (array): Filter by tags
- `limit` (integer): Number of results (default: 10)

**Response:**
```json
{
  "results": [
    {
      "id": "doc_123456",
      "title": "Browser Automation Best Practices",
      "content_snippet": "When creating browser automations, it's important to implement proper error handling and retry logic...",
      "relevance_score": 0.95,
      "category": "documentation",
      "tags": ["browser", "automation", "best-practices"],
      "url": "/knowledge/documents/doc_123456"
    }
  ],
  "total_results": 15,
  "search_time": "0.045s"
}
```

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('wss://api.upmplus.com/ws');
ws.onopen = function() {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token'
  }));
};
```

### Event Types

**Workflow Events:**
```json
{
  "type": "workflow_started",
  "data": {
    "workflow_id": "wf_123456",
    "execution_id": "exec_789012",
    "started_at": "2024-01-15T18:00:00Z"
  }
}
```

**Agent Events:**
```json
{
  "type": "agent_status_changed",
  "data": {
    "agent_id": "agent_123456",
    "old_status": "idle",
    "new_status": "busy",
    "task_id": "task_789012"
  }
}
```

**System Events:**
```json
{
  "type": "system_alert",
  "data": {
    "level": "warning",
    "message": "High CPU usage detected on infrastructure",
    "resource_id": "infra_server_001",
    "timestamp": "2024-01-15T18:05:00Z"
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid workflow configuration",
    "details": {
      "field": "steps[0].config.url",
      "issue": "URL is required for navigate action"
    },
    "request_id": "req_123456789",
    "timestamp": "2024-01-15T18:10:00Z"
  }
}
```

### Common Error Codes

- `AUTHENTICATION_REQUIRED` (401): Missing or invalid authentication
- `AUTHORIZATION_DENIED` (403): Insufficient permissions
- `RESOURCE_NOT_FOUND` (404): Requested resource doesn't exist
- `VALIDATION_ERROR` (400): Invalid request data
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error
- `SERVICE_UNAVAILABLE` (503): Service temporarily unavailable

## Rate Limits

- **Standard Plan**: 1,000 requests per hour
- **Pro Plan**: 10,000 requests per hour  
- **Enterprise Plan**: 100,000 requests per hour

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642262400
```

## SDKs and Libraries

### Official SDKs

- **Python**: `pip install upmplus-sdk`
- **JavaScript/Node.js**: `npm install @upmplus/sdk`
- **Go**: `go get github.com/upm-plus/go-sdk`
- **Java**: Available via Maven Central

### Community SDKs

- **PHP**: `composer require upmplus/php-sdk`
- **Ruby**: `gem install upmplus`
- **C#**: Available via NuGet

## Changelog

### v1.2.0 (2024-01-15)
- Added quantum optimization endpoints
- Enhanced AI assistant capabilities
- Improved error handling and diagnostics
- New webhook event types

### v1.1.0 (2024-01-01)
- Multi-agent collaboration API
- Advanced workflow orchestration
- Real-time WebSocket events
- Enhanced security features

### v1.0.0 (2023-12-01)
- Initial API release
- Core workflow management
- Browser automation
- Basic AI assistant

---

For more information, visit our [Developer Portal](https://developers.upmplus.com) or join our [Discord Community](https://discord.gg/upmplus).