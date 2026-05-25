# Claude Agent Platform API

A comprehensive API for managing AI agents, tasks, and multi-platform application generation.

## 🚀 Features

- **Agent Management**: Complete lifecycle management for AI agents
- **Authentication**: JWT-based authentication with role-based access control
- **Health Monitoring**: Real-time health checks for all services
- **API Documentation**: Auto-generated OpenAPI/Swagger documentation
- **Event-Driven**: RabbitMQ integration for agent lifecycle events
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis integration for performance
- **Logging**: Winston logging with Elasticsearch integration

## 📦 Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up the database**:
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # (Optional) Seed the database
   npm run db:seed
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

## 🏗️ Architecture

### Modules

- **Auth**: Authentication and authorization
- **Users**: User management and profiles
- **Agents**: AI agent lifecycle management
- **Tasks**: Task execution and monitoring (coming soon)
- **Projects**: Project management (coming soon)
- **RAG**: Retrieval-Augmented Generation (coming soon)
- **Tokens**: Token usage and optimization (coming soon)
- **Health**: Service health monitoring

### Database Schema

The platform uses a comprehensive schema with models for:
- Users, Projects, Agents, Tasks
- RAG contexts and token usage
- Audit logs and health checks
- Resource quotas and configurations

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health

## 🔧 Configuration

Key environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`: Redis server host
- `RABBITMQ_URL`: RabbitMQ connection URL
- `JWT_SECRET`: Secret for JWT tokens
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key

## 🚦 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database

# Testing
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run type-check   # Run TypeScript type checking
```

## 🔐 Authentication

The API uses JWT-based authentication:

1. **Register**: `POST /api/v1/auth/register`
2. **Login**: `POST /api/v1/auth/login`
3. **Access**: Include `Bearer <token>` in Authorization header

## 🤖 Agent Management

### Create an Agent
```bash
POST /api/v1/agents
{
  "name": "code-analyzer",
  "type": "TASK_EXECUTOR",
  "version": "1.0.0",
  "config": {
    "runtime": "nodejs",
    "timeout": 300000
  },
  "capabilities": ["code-analysis", "security-review"]
}
```

### Start an Agent
```bash
POST /api/v1/agents/{id}/start
```

### Monitor Agent Health
```bash
GET /api/v1/agents/{id}/health
GET /api/v1/agents/health
```

## 🔍 Monitoring & Health Checks

### Service Health
- **Overall Health**: `/api/v1/health`
- **Readiness**: `/api/v1/health/ready`
- **Liveness**: `/api/v1/health/live`

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15
    },
    "redis": {
      "status": "healthy", 
      "responseTime": 2
    }
  },
  "uptime": 3600000,
  "version": "1.0.0"
}
```

## 📊 Events & Messaging

The platform publishes events for:
- Agent lifecycle changes (created, started, stopped, updated)
- Health status updates
- Task completion events

Events are published to RabbitMQ exchanges:
- `claude-agent.agents`: Agent lifecycle events
- `claude-agent.tasks`: Task execution events
- `claude-agent.rag`: RAG context events

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🐛 Debugging

- **Database**: Use Prisma Studio (`npm run db:studio`)
- **API**: Check Swagger docs at `/api/docs`
- **Logs**: Logs are output to console and Elasticsearch
- **Health**: Check `/api/v1/health` for service status

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.