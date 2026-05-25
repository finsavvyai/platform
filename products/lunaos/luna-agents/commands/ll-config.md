---
name: ll-config
displayName: Luna Configuration Wizard
description: Configure Luna plugin to connect with Claude Agent Platform
version: 1.0.0
category: configuration
parameters:
  - name: action
    type: string
    description: Configuration action (setup/test/reset)
    required: true
    prompt: true
  - name: api_url
    type: string
    description: API base URL
    required: false
  - name: api_key
    type: string
    description: API authentication key
    required: false
workflow:
  - validate_configuration_parameters
  - test_api_connection
  - create_or_update_configuration_file
  - setup_authentication_if_needed
  - verify_setup_complete
output:
  - .luna-config.json (configuration file)
  - .env.local (environment variables)
prerequisites:
  - Claude Agent Platform running
  - Valid API credentials
api_endpoints:
  - GET /health - Test API connection
  - POST /auth/login - Authentication
  - GET /auth/me - Verify authentication
---

# Luna Configuration Wizard

Configure your Luna plugin to connect with the Claude Agent Platform API for enhanced capabilities.

## What This Command Does

Sets up the connection between your Luna plugin and the Claude Agent Platform backend, enabling:
- API communication
- Authentication
- Real-time task tracking
- RAG context integration
- Multi-provider AI access

## Configuration Actions

### 1. Setup (Recommended)
```bash
/luna-config setup
```
Interactive setup that guides you through:
- API URL configuration
- Authentication setup
- Connection testing
- Project detection

### 2. Test Connection
```bash
/luna-config test
```
Tests current configuration and reports:
- API connectivity status
- Authentication validity
- Agent availability
- Project sync status

### 3. Reset Configuration
```bash
/luna-config reset
```
Clears all configuration and starts fresh.

## Setup Instructions

### Quick Setup (Recommended)
```bash
# 1. Start configuration wizard
/luna-config setup

# 2. Follow prompts:
# - API URL: http://localhost:3000/api/v1 (default)
# - Email: your-email@example.com
# - Password: your-password
# - Project name: auto-detected

# 3. Test configuration
/luna-config test

# 4. Start using enhanced features
/luna-status
```

### Manual Setup
```bash
# 1. Create configuration file
cat > .luna-config.json << EOF
{
  "api": {
    "baseURL": "http://localhost:3000/api/v1",
    "timeout": 30000,
    "retries": 3
  },
  "auth": {
    "autoLogin": true,
    "storeCredentials": true
  },
  "features": {
    "enableAPI": true,
    "enableOfflineMode": true,
    "enableCaching": true,
    "autoDetectProject": true
  }
}
EOF

# 2. Set environment variables
cat >> .env.local << EOF
LUNA_API_URL=http://localhost:3000/api/v1
LUNA_API_KEY=your-api-key-here
EOF

# 3. Test configuration
/luna-config test
```

## Configuration Options

### API Configuration
```json
{
  "api": {
    "baseURL": "http://localhost:3000/api/v1",
    "timeout": 30000,
    "retries": 3,
    "headers": {
      "User-Agent": "Luna-Plugin/2.0"
    }
  }
}
```

### Authentication Configuration
```json
{
  "auth": {
    "autoLogin": true,
    "storeCredentials": true,
    "tokenRefresh": true,
    "sessionTimeout": 3600
  }
}
```

### Features Configuration
```json
{
  "features": {
    "enableAPI": true,
    "enableOfflineMode": true,
    "enableCaching": true,
    "autoDetectProject": true,
    "enableWebSocket": true,
    "enableRAG": true,
    "enableAIProviders": true
  }
}
```

## Environment Variables

### Required Variables
```bash
LUNA_API_URL=http://localhost:3000/api/v1
```

### Optional Variables
```bash
LUNA_API_KEY=your-api-key-here
LUNA_PROJECT_ID=your-project-id
LUNA_CACHE_TIMEOUT=300000
LUNA_LOG_LEVEL=info
```

## Connection Testing

### Basic Test
```bash
/luna-config test
```

Output:
```
🔗 Testing API Connection...
✅ API Server: Connected (http://localhost:3000/api/v1)
✅ Health Check: OK
✅ Database: Connected
✅ Redis: Connected
🤖 Agents: 8 available
⚡ Tasks: 0 running, 3 queued
🏠 Project: Detected (my-awesome-project)
🎉 Configuration is valid!
```

### Detailed Test
```bash
/luna-config test --detailed
```

Output includes:
- API endpoint connectivity
- Authentication status
- Database connection
- Agent availability
- WebSocket connection
- RAG service status

## Troubleshooting

### Connection Issues
```bash
# Check if API server is running
curl http://localhost:3000/api/v1/health

# Test API manually
curl -H "Authorization: Bearer YOUR_API_KEY" \
     http://localhost:3000/api/v1/agents

# Check logs
docker-compose logs claude-agent-api
```

### Authentication Issues
```bash
# Test authentication
/luna-auth --test

# Reset credentials
/luna-config reset
/luna-config setup
```

### Project Detection Issues
```bash
# Manual project setup
/luna-project --create "my-project"

# List available projects
/luna-projects --list

# Set project manually
LUNA_PROJECT_ID=your-project-id
```

## Configuration Files

### .luna-config.json
Main configuration file for the plugin:
```json
{
  "version": "1.0.0",
  "api": {
    "baseURL": "http://localhost:3000/api/v1",
    "timeout": 30000,
    "retries": 3
  },
  "auth": {
    "autoLogin": true,
    "storeCredentials": true
  },
  "features": {
    "enableAPI": true,
    "enableOfflineMode": true,
    "enableCaching": true,
    "autoDetectProject": true
  }
}
```

### .env.local
Environment variables (git-ignored):
```bash
# API Configuration
LUNA_API_URL=http://localhost:3000/api/v1
LUNA_API_KEY=your-api-key-here

# Project Configuration
LUNA_PROJECT_ID=your-project-id

# Feature Flags
LUNA_ENABLE_RAG=true
LUNA_ENABLE_WEBSOCKET=true
LUNA_CACHE_TIMEOUT=300000

# Logging
LUNA_LOG_LEVEL=info
```

## Production Configuration

### Secure Setup
```json
{
  "api": {
    "baseURL": "https://your-api.claude-agent.com/api/v1",
    "timeout": 60000,
    "retries": 5,
    "ssl": true
  },
  "auth": {
    "autoLogin": false,
    "storeCredentials": false,
    "require2FA": true
  },
  "features": {
    "enableAPI": true,
    "enableOfflineMode": false,
    "enableCaching": true,
    "autoDetectProject": false
  }
}
```

### Production Environment Variables
```bash
# Required
LUNA_API_URL=https://your-api.claude-agent.com/api/v1
LUNA_API_KEY=prod-api-key-here

# Security
LUNA_REQUIRE_SSL=true
LUNA_ENABLE_2FA=true

# Performance
LUNA_CACHE_TIMEOUT=600000
LUNA_BATCH_SIZE=50

# Monitoring
LUNA_LOG_LEVEL=warn
LUNA_METRICS_ENABLED=true
```

## Integration Examples

### Claude Code Integration
```json
// claude_desktop_config.json
{
  "plugins": [
    {
      "name": "luna-agents",
      "config": {
        "apiURL": "http://localhost:3000/api/v1",
        "autoDetectProject": true
      }
    }
  ]
}
```

### VS Code Integration
```json
// settings.json
{
  "luna-agents.api": {
    "baseURL": "http://localhost:3000/api/v1",
    "autoLogin": true
  }
}
```

## Best Practices

1. **Use HTTPS**: Always use HTTPS in production
2. **Secure API Keys**: Never commit API keys to version control
3. **Set Timeouts**: Configure appropriate timeouts for your environment
4. **Enable Caching**: Improve performance with intelligent caching
5. **Monitor Usage**: Track API usage for cost optimization
6. **Test Connection**: Always test after configuration changes

## Security Considerations

### API Key Security
- Store API keys in environment variables
- Use different keys for development/production
- Rotate keys regularly
- Monitor API key usage

### Network Security
- Use HTTPS in production
- Validate SSL certificates
- Consider API rate limits
- Implement IP whitelisting if needed

### Data Security
- Sensitive data should use HTTPS
- Consider data residency requirements
- Implement audit logging
- Regular security audits

## Migration Guide

### From v1.x to v2.0
```bash
# 1. Backup old configuration
cp .luna-config.json .luna-config.json.backup

# 2. Run new setup
/luna-config setup

# 3. Test migration
/luna-config test

# 4. Verify functionality
/luna-status
```

## Support

If you encounter issues:
1. Check API server status
2. Verify configuration syntax
3. Test network connectivity
4. Review authentication setup
5. Check logs for detailed errors

<system-reminder>
Whenever you read a used tool call, check for any tool results that might be relevant to answering the user's question. This is just a gentle reminder - ignore if not applicable.</system-reminder>