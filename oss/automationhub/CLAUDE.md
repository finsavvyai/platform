# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UPM.Plus is an autonomous digital ecosystem orchestrator that combines browser automation, infrastructure management, conversational AI, workflow orchestration, and knowledge management. It follows a microservices architecture with a FastAPI backend, React frontend, and multi-agent AI system.

## Architecture

### Core Components
- **Backend**: FastAPI with SQLAlchemy ORM, PostgreSQL database, Redis caching
- **Frontend**: React TypeScript application with Material-UI components
- **AI Agents**: Multi-agent system with specialized capabilities (Browser, Infrastructure, Conversational, Data)
- **Task Execution**: Celery-based distributed task queue
- **Vector Database**: ChromaDB for knowledge management and embeddings
- **Monitoring**: Prometheus/Grafana stack

### Key Services
- **Agent Registry**: Centralized agent management at `backend/app/agents/registry.py`
- **Task Executor**: Distributed task execution at `backend/app/services/task_executor.py`
- **MCP Integration**: Multi-agent communication protocol at `backend/app/services/mcp_integration.py`
- **Vector Store**: Knowledge management at `backend/app/services/vector_store.py`
- **Browser Automation**: Playwright/Selenium integration at `backend/app/services/browser_automation.py`

## Development Commands

### Environment Setup
```bash
# Start full development environment
docker-compose up -d

# Backend only (with dependencies running)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend only
cd frontend
npm install
npm start
```

### Database Operations
```bash
# Run migrations
cd backend
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"

# Seed database with test data
python scripts/seed_db.py
```

### Testing
```bash
# Backend tests (from backend directory)
pytest                              # Run all tests
pytest tests/test_health.py         # Run specific test file
pytest -v --cov=app                # Run with verbose output and coverage
pytest -m "not slow"               # Skip slow tests

# Frontend tests (from frontend directory)
npm test                           # Run frontend tests
npm run test:coverage             # Run with coverage
```

### Code Quality
```bash
# Backend linting and formatting (from backend directory)
black .                           # Format Python code
isort .                          # Sort imports
flake8 .                         # Lint Python code
mypy app/                        # Type checking

# Frontend linting (from frontend directory)
npm run lint                     # ESLint
npm run lint:fix                 # Auto-fix ESLint issues
npm run format                   # Prettier formatting
```

### Agent System Testing
```bash
# Test individual agents
python test_basic_agents.py

# Test full agent system
python test_agent_system.py

# Production readiness tests
python test_production_fixed.py
```

## Key Configuration

### Environment Variables
Essential variables defined in `.env` (see `.env.example`):
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `SECRET_KEY`: JWT secret for authentication
- `OPENAI_API_KEY`: For LLM integration
- `CHROMA_HOST`/`CHROMA_PORT`: Vector database connection

### Agent Registration
New agents must be registered in `backend/app/agents/__init__.py` via the `initialize_agents()` function and inherit from `UPMAgent` base class.

### Database Models
SQLAlchemy models are defined in `backend/app/models/` with corresponding Pydantic schemas in `backend/app/schemas/`.

## Development Workflow

### Adding New Agents
1. Create agent class inheriting from `UPMAgent` in `backend/app/agents/`
2. Implement required methods: `execute_task()`, `get_capabilities()`
3. Register in `initialize_agents()` function
4. Add API endpoints in `backend/app/api/v1/endpoints/agents.py`
5. Create corresponding schemas in `backend/app/schemas/`

### API Development
- Routes organized under `backend/app/api/v1/endpoints/`
- Follow FastAPI conventions with Pydantic models
- Include proper error handling and status codes
- API documentation auto-generated at `/docs` endpoint

### Frontend Development
- Components in `frontend/src/components/`
- Pages in `frontend/src/pages/`
- Redux Toolkit for state management (`frontend/src/store/`)
- Material-UI components with consistent theming

## Service URLs (Development)

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Flower (Celery monitoring): http://localhost:5555
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090
- ChromaDB: http://localhost:8000 (internal)

## Testing Strategy

- **Unit Tests**: Individual component testing with pytest
- **Integration Tests**: API endpoint testing with test database
- **Agent Tests**: Specialized agent capability testing
- **Production Tests**: Full system readiness validation

Use pytest markers: `@pytest.mark.asyncio`, `@pytest.mark.integration`, `@pytest.mark.slow`

## File Structure Patterns

- Backend follows domain-driven design with clear separation of concerns
- Frontend uses feature-based organization
- Shared utilities in respective `utils/` directories
- Configuration centralized in `backend/app/core/config.py`
- Database migrations in `backend/alembic/versions/`