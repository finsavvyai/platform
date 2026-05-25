# UPM.Plus Quick Start Guide

Get UPM.Plus running in 5 minutes!

## Prerequisites

- Python 3.10+
- Node.js 18+
- Redis (install via `brew install redis` on macOS or `apt-get install redis` on Linux)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd automationhub
```

### 2. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
ENVIRONMENT=development
DEBUG=True
SECRET_KEY=dev-secret-key-change-in-production
DATABASE_URL=sqlite+aiosqlite:///./test.db
REDIS_URL=redis://localhost:6379/0
EOF

# Initialize database
python -c "from app.core.database import init_database, create_tables; import asyncio; asyncio.run(create_tables())"
```

### 3. Start Redis

```bash
# In a new terminal
redis-server
```

### 4. Start Backend

```bash
# In backend directory
cd backend
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
uvicorn app.main:app --reload --port 8000
```

Backend will be available at: http://localhost:8000
API Docs: http://localhost:8000/docs

### 5. Start Frontend (Optional)

```bash
# In a new terminal
cd frontend
npm install
npm start
```

Frontend will be available at: http://localhost:3000

## Verify Installation

### Check Backend Health

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "vector_db": "connected"
}
```

### Test Agent API

```bash
# List agents
curl http://localhost:8000/api/v1/agents

# Create an agent
curl -X POST http://localhost:8000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Browser Agent",
    "agent_type": "browser",
    "description": "A test browser agent"
  }'
```

## Using the API

### Authentication

Most endpoints require authentication. Get a token:

```bash
# Register (if endpoint exists)
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "username": "testuser"
  }'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'
```

Use the returned `access_token` in subsequent requests:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/v1/agents
```

## Common Tasks

### Create and Execute a Workflow

```bash
# Create workflow
curl -X POST http://localhost:8000/api/v1/workflows \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Workflow",
    "description": "A simple workflow",
    "nodes": [
      {"id": "start", "type": "start", "name": "Start"},
      {"id": "end", "type": "end", "name": "End"}
    ],
    "connections": [
      {"source_node_id": "start", "target_node_id": "end"}
    ]
  }'

# Execute workflow (use workflow_id from response)
curl -X POST http://localhost:8000/api/v1/workflows/WORKFLOW_ID/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input_data": {}}'
```

### Monitor Agent Status

```bash
# Get agent status
curl http://localhost:8000/api/v1/agents/AGENT_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Backend won't start

1. **Check Redis**: `redis-cli ping` should return `PONG`
2. **Check port**: Ensure port 8000 is not in use
3. **Check dependencies**: `pip install -r requirements.txt`

### Agents not working

1. **Check logs**: Look for agent initialization errors
2. **Verify database**: Ensure tables are created
3. **Check Redis**: Agents use Redis for coordination

### Frontend can't connect

1. **Check API URL**: Verify `REACT_APP_API_URL` in `.env`
2. **Check CORS**: Backend should allow frontend origin
3. **Check backend**: Ensure backend is running on port 8000

## Next Steps

1. **Explore API**: Visit http://localhost:8000/docs for interactive API documentation
2. **Read Documentation**: See `PRODUCTION_DEPLOYMENT.md` for production setup
3. **Check Status**: See `IMPLEMENTATION_STATUS.md` for current implementation status
4. **Run Tests**: `cd backend && pytest tests/`

## Development Tips

- Use `--reload` flag for auto-reload during development
- Check logs in terminal for debugging
- Use API docs at `/docs` for testing endpoints
- Frontend hot-reloads automatically on file changes

## Getting Help

- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Gateway Info**: http://localhost:8000/api/v1/gateway/info

Happy automating! 🚀


