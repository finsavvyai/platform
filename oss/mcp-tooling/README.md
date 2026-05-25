# MCPOverflow - AI-Powered MCP Connector Platform

## 🚀 Project Overview

MCPOverflow is a comprehensive platform for generating and managing Model Context Protocol (MCP) connectors from various API specifications. It enables users to instantly convert OpenAPI, GraphQL, and Postman collections into fully functional MCP connectors with AgentKit integration for autonomous AI agent deployment.

## ✨ Key Features

### 🔧 Core Capabilities
- **Multi-Format API Parsing**: Support for OpenAPI 3.x, GraphQL schemas, and Postman collections
- **Intelligent MCP Generation**: Automatic conversion of API endpoints to MCP tools
- **AgentKit Integration**: Built-in support for OpenAI AgentKit autonomous agent deployment
- **Multiple Runtime Support**: Deploy to Cloudflare Workers, Vercel Edge Functions, and more
- **Authentication Management**: Handle API keys, OAuth 2.0, JWT, and custom auth methods
- **Cross-Domain SSO**: Seamless authentication across multiple domains

### 🛠 Technical Stack
- **Backend**: Go with Gin framework
- **Frontend**: React, TypeScript, Next.js
- **Database**: PostgreSQL with Supabase
- **Caching**: Redis
- **Graph Database**: Neo4j
- **Vector Search**: Qdrant
- **Monitoring**: Prometheus & Grafana
- **Deployment**: Docker, Cloudflare Workers

## 🏗 Architecture

### Multi-Domain Platform
MCPOverflow supports four specialized domains:

1. **Marketing** (`mcpoverflow.com`) - Landing page and product information
2. **Developer** (`app.mcpoverflow.io`) - Main development platform
3. **AI Platform** (`mcpoverflow.ai`) - AI-powered features and insights
4. **Documentation** (`mcpoverflow.dev`) - Comprehensive documentation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Go 1.21+ and TinyGo (for WASM compilation)
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-org/mcpoverflow.git
cd mcpoverflow
```

2. **Install dependencies**
```bash
make setup
```

3. **Start development environment**
```bash
# Start database services
make dev-services

# Start application servers
make dev
```

### Access Points

Once deployed, you can access the platform at:

- **🏠 Marketing Site**: http://localhost/
- **👨‍💻 Developer Platform**: http://localhost/developer
- **📚 Documentation**: http://localhost/docs
- **🔌 API Endpoint**: http://localhost/api

## 📖 Usage Guide

### Creating a Connector

1. **Navigate to Developer Platform**: Open http://localhost/developer
2. **Click "Create New Connector"**
3. **Choose your API specification format**:
   - Upload OpenAPI/Swagger file
   - Provide GraphQL introspection URL
   - Upload Postman collection
4. **Configure authentication** (API key, OAuth, JWT, etc.)
5. **Select endpoints** to include
6. **Choose deployment target** (Cloudflare Workers, etc.)
7. **Deploy** with one click

## 🛠 Development

### Project Structure
```
mcpoverflow/
├── apps/                    # Frontend applications
│   ├── marketing/           # Marketing website
│   ├── dev-platform/        # Developer platform
│   ├── ai-platform/         # AI platform interface
│   └── docs-site/           # Documentation site
├── packages/               # Shared packages
│   ├── codegen/            # Code generation engine
│   ├── frontend-config/    # Frontend configuration
│   └── ui/                 # UI components
├── services/               # Backend services
│   └── api-service/        # Main API service
├── scripts/                # Build and deployment scripts
└── docs/                  # Documentation
```

### Building Components

```bash
# Build all frontend applications
npm run build

# Build specific domain
npm run build:marketing
npm run build:developer

# Build Go services
cd services/api-service && go build ./...

# Generate MCP connectors
npm run codegen
```

### Running Tests

```bash
# Run all tests
make test

# Run specific test suites
npm run test:unit
go test ./...
```

## 🚢 Deployment

### Development Deployment
```bash
# Full development deployment
./scripts/deploy-simple.sh deploy
```

### Production Deployment
```bash
# Production deployment with all services
./scripts/deploy.sh deploy
```

## 📊 Monitoring

### Available Dashboards
- **Grafana**: http://localhost:3001 (admin/mcpoverflow_admin)
- **Prometheus**: http://localhost:9090

### Health Checks
```bash
# Check all services
make health

# Check specific service
curl http://localhost/api/health
```

## 🔧 Configuration & Production

### Operational Documentation
- **[Deployment Runbook](docs/deployment_runbook.md)**: Standard procedures for deploying to production.
- **[Troubleshooting Guide](docs/troubleshooting.md)**: Diagnostics for common issues.
- **[CI/CD Setup](docs/cicd_setup.md)**: Guide for configuring GitHub Actions.
- **[API Documentation](docs/api_documentation.md)**: Developer guide for authentication and usage.

### Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=mcpoverflow

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# Cloudflare
CLOUDFLARE_API_TOKEN=your-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.mcpoverflow.dev](http://localhost/docs)
- **Issues**: [GitHub Issues](https://github.com/your-org/mcpoverflow/issues)
- **Community**: [Discord Community](https://discord.gg/mcpoverflow)

## 🗺 Roadmap

### Completed ✅
- [x] Multi-format API parsing (OpenAPI, GraphQL, Postman)
- [x] MCP code generation with AgentKit integration
- [x] Authentication system (OAuth, JWT, API keys)
- [x] Cross-domain SSO
- [x] Cloudflare Workers deployment
- [x] Comprehensive testing suite

### In Progress 🚧
- [ ] Vercel Edge Functions deployment
- [ ] AWS Lambda deployment support
- [ ] Advanced monitoring and analytics
- [ ] Team collaboration features
- [ ] Billing and subscription management

---

**Built with ❤️ for the AI agent ecosystem**