# UPM.Plus Documentation

Welcome to the comprehensive documentation for UPM.Plus - The Autonomous Digital Ecosystem Orchestrator.

## 🚀 Quick Start

### What is UPM.Plus?

UPM.Plus is a next-generation AI platform that unifies browser automation, infrastructure management, conversational AI, workflow orchestration, and knowledge management into a single, self-evolving digital ecosystem.

### Key Features

- **🤖 AI-Powered Workflows**: Create complex automations using natural language
- **🌐 MCP Integration**: Industry-first Model Context Protocol support
- **📚 Knowledge Management**: RAG-powered document processing and search
- **💬 Conversational AI**: Intelligent chat with context awareness
- **📊 Real-time Monitoring**: Track system performance and workflow execution
- **🔒 Enterprise Security**: Comprehensive security and compliance features

## 📖 Table of Contents

1. [Getting Started](#getting-started)
2. [Core Concepts](#core-concepts)
3. [User Guide](#user-guide)
4. [Developer Guide](#developer-guide)
5. [API Reference](#api-reference)
6. [Tutorials](#tutorials)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

## Getting Started

### System Requirements

- **Backend**: Python 3.11+, PostgreSQL, Redis, ChromaDB
- **Frontend**: Node.js 18+, modern web browser
- **Infrastructure**: Docker, Kubernetes (for production)

### Installation

#### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/upm-plus.git
   cd upm-plus
   ```

2. **Start development environment**
   ```bash
   docker-compose up -d
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

5. **Run database migrations**
   ```bash
   cd backend
   alembic upgrade head
   ```

6. **Start the development servers**
   ```bash
   # Backend (Terminal 1)
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

   # Frontend (Terminal 2)
   cd frontend
   npm start
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

#### Production Deployment

For production deployment using Kubernetes:

```bash
# Apply all configurations
kubectl apply -f deployment/kubernetes/

# Check deployment status
kubectl get pods -n upm-plus
```

## Core Concepts

### Workflows

Workflows are visual representations of automation processes that connect different nodes (actions, triggers, conditions) to create complex automations.

#### Node Types

- **Triggers**: Start workflows automatically (schedule, webhook, manual)
- **Agents**: AI-powered task execution (Browser, Infrastructure, Conversational, Data)
- **Actions**: Custom code execution and API calls
- **Conditions**: Branching logic and decision points
- **Transform**: Data manipulation and formatting
- **MCP Tools**: Integration with external tools and services

### Knowledge Management

The knowledge management system processes documents and makes them searchable using AI-powered semantic search.

#### Supported Document Types
- PDF files
- Microsoft Word documents
- Text files (.txt, .md)
- JSON and CSV files
- HTML web pages
- Code files

#### Features
- Automatic document processing
- Semantic search
- AI-powered chat interface
- Tag-based organization

### AI Agents

UPM.Plus includes specialized AI agents for different types of tasks:

- **Browser Agent**: Web automation and scraping
- **Infrastructure Agent**: System management and deployment
- **Conversational Agent**: Natural language processing
- **Data Agent**: Data processing and analysis

## User Guide

### Creating Your First Workflow

1. **Navigate to Workflows**: Click on "Workflows" in the navigation menu
2. **Add a Trigger**: Click "Add Node" and select a trigger type
3. **Add Actions**: Add action nodes and configure them
4. **Connect Nodes**: Drag connections between nodes to define flow
5. **Test and Execute**: Use the test mode, then execute the workflow

### Uploading Documents

1. **Go to Knowledge Management**: Navigate to the Knowledge tab
2. **Upload Files**: Click "Upload Documents" and select files
3. **Wait for Processing**: Documents are automatically processed
4. **Search and Chat**: Use the search bar or chat interface to query documents

### Monitoring System Health

The dashboard provides real-time monitoring of:
- System resources (CPU, memory, disk)
- Active workflow executions
- Agent status and performance
- Recent log entries

## Developer Guide

### API Overview

UPM.Plus provides a comprehensive REST API for all functionality:

- **Authentication**: `/api/v1/auth/`
- **Workflows**: `/api/v1/workflows/`
- **Knowledge**: `/api/v1/knowledge/`
- **Chat**: `/api/v1/chat/`
- **Agents**: `/api/v1/agents/`
- **Monitoring**: `/api/v1/monitoring/`

### Authentication

The API uses JWT tokens for authentication:

```bash
# Login
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use token
curl -X GET "http://localhost:8000/api/v1/workflows" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Creating Workflows via API

```bash
curl -X POST "http://localhost:8000/api/v1/workflows" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Workflow",
    "description": "Automated workflow",
    "nodes": [...],
    "edges": [...]
  }'
```

### WebSocket Connections

Real-time updates are available via WebSocket:

```javascript
const socket = io('http://localhost:8000', {
  path: '/ws',
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

socket.on('workflow_update', (data) => {
  console.log('Workflow updated:', data);
});
```

## Tutorials

### Tutorial 1: Web Scraping Automation

Learn how to create a workflow that automatically scrapes data from websites.

[Read Tutorial →](tutorials/web-scraping.md)

### Tutorial 2: Document Analysis Pipeline

Build a workflow that processes uploaded documents and extracts insights.

[Read Tutorial →](tutorials/document-analysis.md)

### Tutorial 3: API Monitoring and Alerting

Set up automated monitoring of external APIs with alerting.

[Read Tutorial →](tutorials/api-monitoring.md)

### Tutorial 4: Multi-Agent Collaboration

Coordinate multiple AI agents to work together on complex tasks.

[Read Tutorial →](tutorials/multi-agent.md)

## API Reference

### Authentication Endpoints

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

#### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "full_name": "John Doe"
}
```

### Workflow Endpoints

#### List Workflows
```http
GET /api/v1/workflows
Authorization: Bearer JWT_TOKEN
```

#### Create Workflow
```http
POST /api/v1/workflows
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "name": "Workflow Name",
  "description": "Description",
  "nodes": [...],
  "edges": [...]
}
```

#### Execute Workflow
```http
POST /api/v1/workflows/{workflow_id}/execute
Authorization: Bearer JWT_TOKEN
```

### Knowledge Endpoints

#### Upload Document
```http
POST /api/v1/knowledge/documents/upload
Authorization: Bearer JWT_TOKEN
Content-Type: multipart/form-data

files: [file1, file2, ...]
```

#### Search Documents
```http
POST /api/v1/knowledge/search
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "query": "search query",
  "limit": 20
}
```

## Troubleshooting

### Common Issues

#### Workflow Execution Fails

**Problem**: Workflow stops executing or shows errors.

**Solutions**:
1. Check node configurations for missing required fields
2. Verify API credentials and permissions
3. Review system logs for detailed error messages
4. Test individual nodes in isolation

#### Document Processing Issues

**Problem**: Documents fail to process or search returns no results.

**Solutions**:
1. Ensure documents are in supported formats
2. Check file size limits (max 10MB per file)
3. Verify ChromaDB connection and status
4. Try re-uploading problematic documents

#### Performance Issues

**Problem**: Slow response times or high resource usage.

**Solutions**:
1. Monitor system metrics on the dashboard
2. Optimize workflow designs to reduce complexity
3. Increase system resources if needed
4. Check for memory leaks in custom code

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| AUTH_001 | Invalid credentials | Check email/password |
| AUTH_002 | Token expired | Refresh JWT token |
| WORKFLOW_001 | Invalid node configuration | Review node settings |
| KNOWLEDGE_001 | Document processing failed | Re-upload document |
| SYSTEM_001 | Resource limit exceeded | Upgrade resources |

## FAQ

### General Questions

**Q: What is UPM.Plus?**
A: UPM.Plus is an autonomous digital ecosystem orchestrator that combines AI-powered automation, knowledge management, and workflow orchestration.

**Q: How does the AI workflow generation work?**
A: Simply describe your automation needs in natural language, and our AI will generate a complete workflow with appropriate nodes and connections.

**Q: What document types are supported?**
A: We support PDF, Word, text, JSON, CSV, HTML, and code files.

### Technical Questions

**Q: Can I self-host UPM.Plus?**
A: Yes, UPM.Plus is open-source and can be deployed on your own infrastructure using Docker and Kubernetes.

**Q: What are the system requirements?**
A: Minimum requirements: 4GB RAM, 2 CPU cores, 20GB storage. Recommended: 8GB RAM, 4 CPU cores, 50GB storage.

**Q: Is there an API available?**
A: Yes, we provide a comprehensive REST API and WebSocket connections for real-time updates.

### Pricing and Licensing

**Q: Is UPM.Plus free?**
A: We offer a free tier with limited usage, plus paid plans for advanced features and higher usage limits.

**Q: What's included in the free tier?**
A: The free tier includes up to 5 workflows, 100 document uploads, and basic AI agent usage.

## Getting Help

- **Documentation**: [docs.upmplus.ai](https://docs.upmplus.ai)
- **Community Discord**: [Join our server](https://discord.gg/upmplus)
- **Support Email**: support@upmplus.ai
- **GitHub Issues**: [Report bugs](https://github.com/your-org/upm-plus/issues)

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to contribute to UPM.Plus.

## License

UPM.Plus is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.