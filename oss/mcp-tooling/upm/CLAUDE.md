# UPM (Universal Dependency Manager) — CLAUDE.md

> **Portfolio Tracker**: `../../../portfolio-tracker.html` | **Readiness**: 74% | **Category**: BUILD

## Mission
Enterprise-grade cross-language dependency management platform with LangGraph workflow orchestration. Provides unified governance for npm, pip, cargo, maven, gradle across teams—integrating AI for intelligent dependency recommendations and security scanning.

## Code Map & Index
### Directory Structure
```
upm/
├── src/udp/
│   ├── api/                      # FastAPI routes (versioned endpoints)
│   │   ├── routes/
│   │   ├── dependencies.py       # Dependency REST endpoints
│   │   └── workflows.py          # Workflow execution endpoints
│   ├── core/
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── schemas/              # Pydantic validation schemas
│   │   ├── config.py             # Settings and configuration
│   │   └── constants.py          # Framework constants
│   ├── workflows/                # LangGraph state graphs
│   │   ├── dependency_flow.py    # Dependency resolution workflow
│   │   ├── approval_flow.py      # Multi-stakeholder approval
│   │   └── orchestrator.py       # Workflow coordinator
│   ├── services/                 # Business logic
│   │   ├── dependency_service.py # Core dependency management
│   │   ├── resolver_service.py   # Conflict resolution
│   │   └── notification_service.py # Event notifications
│   ├── infrastructure/           # External integrations
│   │   ├── database.py           # SQLAlchemy setup
│   │   ├── cache.py              # Redis cache layer
│   │   └── external_api.py       # Third-party API clients
│   ├── tools/                    # Ecosystem-specific tools
│   │   ├── ecosystems/           # Framework handlers
│   │   │   ├── npm.py            # Node.js (npm, yarn, pnpm)
│   │   │   ├── pip.py            # Python (pip, poetry, pipenv)
│   │   │   ├── cargo.py          # Rust (cargo)
│   │   │   └── factory.py        # Ecosystem factory
│   │   ├── vulnerability_scanner.py  # Security scanning
│   │   └── sbom_generator.py     # SBOM generation
│   ├── security/                 # Auth and authorization
│   │   ├── auth.py               # JWT token handling
│   │   ├── permissions.py        # RBAC policies
│   │   └── policies.py           # Security policies
│   ├── analytics/                # ML and analytics
│   │   ├── recommender.py        # AI dependency recommendations
│   │   └── risk_analyzer.py      # Risk scoring
│   ├── monitoring/               # Observability
│   │   ├── logging.py            # Structured logging
│   │   └── metrics.py            # Prometheus metrics
│   ├── visualization/            # Data visualization
│   │   ├── dashboard.py          # Web UI
│   │   ├── graph_visualizer.py   # Dependency graphs
│   │   └── analytics.py          # Analytics visualizations
│   └── main.py                   # FastAPI app entry point
├── tests/
│   ├── unit/                     # Unit tests (single component)
│   ├── integration/              # Integration tests (multi-component)
│   └── e2e/                      # End-to-end tests
├── migrations/                   # Alembic SQL migrations
├── docker-compose.yml
├── pyproject.toml                # Poetry dependencies and config
├── mypy.ini
├── pytest.ini
└── CLAUDE.md (this file)
```

### Key Files Index
| File | Purpose | Lines |
|------|---------|-------|
| src/udp/api/routes/dependencies.py | REST endpoints | ~180 |
| src/udp/core/models/__init__.py | SQLAlchemy ORM | ~200 |
| src/udp/workflows/dependency_flow.py | LangGraph workflow | ~190 |
| src/udp/services/dependency_service.py | Core business logic | ~200 |
| src/udp/tools/ecosystems/npm.py | npm/yarn/pnpm handler | ~150 |
| src/udp/tools/ecosystems/pip.py | Python ecosystem handler | ~160 |
| src/udp/analytics/recommender.py | AI recommendations | ~140 |
| src/udp/main.py | FastAPI setup | ~100 |

## Development Guidelines
### Code Design Standards
- **Max 200 lines per file** — split service logic across multiple files if exceeding
- **Single Responsibility** — npm handler only handles npm, pip handler only handles pip
- **Type Safety** — strict Python type hints everywhere, mypy in strict mode
- **Error Handling** — custom exception hierarchy, never swallow exceptions
- **Naming** — descriptive (resolve_dependency_conflict, get_vulnerable_packages)
- **No Magic Values** — timeout values, retry counts, risk thresholds in config
- **Dependency Injection** — services take dependencies via __init__, not globals
- **Pure Functions First** — calculation/analysis functions pure, I/O at service layer

### Architecture Patterns
- **FastAPI App** — Async endpoints, Pydantic validation, JWT middleware
- **Database Layer** — SQLAlchemy async ORM, connection pooling, migrations with Alembic
- **Workflow Orchestration** — LangGraph state machines for approval flows
- **Ecosystem Abstraction** — Factory pattern for npm/pip/cargo/maven handlers
- **Service Layer** — Business logic independent of API/workflow
- **Analytics** — ML-based recommender system, risk scoring
- **Caching** — Redis for dependency graphs, vulnerability data, user sessions
- **Monitoring** — Structured logging (Python logging), Prometheus metrics

### Code Review Checklist
- [ ] No file exceeds 200 lines
- [ ] All public functions have type hints for parameters and return types
- [ ] No use of `Any` type unless unavoidable (with # type: ignore comment)
- [ ] All exceptions are caught and handled (no silent except: pass)
- [ ] No hardcoded API keys or credentials (use environment variables)
- [ ] Database queries use parameterized statements (SQLAlchemy handles this)
- [ ] All async functions properly awaited
- [ ] Pydantic schemas validate input at API boundaries
- [ ] Error responses follow consistent format
- [ ] Tests exist for all public functions (95%+ coverage)

## Testing Strategy
### Unit Tests — Full Coverage Required
- **Framework**: pytest with pytest-asyncio for async tests
- **Coverage Target**: 95%+ lines, 90%+ branches
- **Run**: `python -m pytest tests/ -v --cov=src/udp --cov-report=term-missing`
- **Test Pattern**: Each module has corresponding test_*.py file in tests/unit/

### Test Categories
- **Ecosystem tests**: npm resolver, pip resolver, cargo resolver (conflict detection, version matching)
- **Service tests**: Dependency resolution, vulnerability scanning, approval workflow
- **API tests**: Route validation, auth checks, error responses
- **Workflow tests**: LangGraph state transitions, approval flow with multiple reviewers
- **Database tests**: ORM query correctness, transaction rollback, constraint validation
- **Integration tests**: Full workflow from API → service → database → external API

### Browser / Claude Chrome Extension Tests
- **Tool**: Claude in Chrome MCP + Playwright for web UI testing
- **Flows to test**:
  1. **Dependency Upload**: User uploads package.json/requirements.txt → system detects ecosystem → shows dependency tree
  2. **Conflict Resolution**: Create conflicting versions → AI recommender suggests resolution → user approves → workflow completes
  3. **Vulnerability Scan**: Upload dependencies → system scans CVE database → shows high-risk packages → user can update or suppress
  4. **Multi-Stakeholder Approval**: Create policy requiring 2+ reviewers → first reviewer approves → notification to second → second approves → policy applied
  5. **Recommendation Engine**: View AI recommendations based on project → accept recommendation → auto-generate PR with changes
  6. **Analytics Dashboard**: View dependency trends, outdated packages, security posture over time
- **Personas**: Tech lead, DevOps engineer, security officer, full-stack developer, manager

## Commands
```bash
# Development Setup
poetry install                      # Install dependencies
poetry shell                        # Activate virtual environment
uvicorn src.udp.api.main:app --reload --port 8040  # Start dev server

# Testing
python -m pytest tests/ -v                          # Run all tests
python -m pytest tests/unit/ -v                     # Unit tests only
python -m pytest tests/integration/ -v              # Integration tests
python -m pytest -m unit --cov=src/udp              # Coverage report

# Code Quality
ruff check src/ tests/              # Linting
ruff format src/ tests/             # Auto-format
mypy src/udp                        # Type checking
bandit -r src/udp                   # Security scanning
python -m pytest tests/ --tb=short  # Test with error summaries

# Database
alembic upgrade head                # Apply all migrations
alembic downgrade -1                # Rollback last migration
alembic revision --autogenerate -m "description"  # Create migration

# Docker
docker-compose up                   # Start all services (API, DB, Redis, etc.)
docker-compose down                 # Stop all services
docker-compose logs -f api          # Stream API logs

# All Quality Checks
ruff check . && mypy src/udp && bandit -r src/udp && python -m pytest tests/ -v
```

## What's Done vs What's Left
### Completed (74%)
- FastAPI application with JWT auth
- SQLAlchemy async ORM with database models
- Alembic migration system
- LangGraph workflow orchestration
- npm ecosystem handler (dependencies, lock files, version resolution)
- pip ecosystem handler (Python packages, virtual envs)
- cargo ecosystem handler (Rust packages)
- Vulnerability scanning integration
- SBOM generation
- Redis caching layer
- Structured logging
- Prometheus metrics
- API route handlers (dependencies, workflows)
- Service layer business logic
- Unit tests with 85%+ coverage

### Remaining (26%)
- Complete pip/poetry/pipenv handler edge cases
- Maven and Gradle ecosystem handlers
- Advanced approval workflow with multiple stakeholders
- AI recommender system (LLM integration for suggestions)
- Web dashboard UI (React frontend)
- E2E tests with Claude in Chrome MCP
- Performance optimization (query caching, async improvements)
- Production deployment configuration
- Health checks and monitoring endpoints
- Documentation (API spec, workflow examples)

## Competitors & Market Context
**Target Market**: Enterprise development teams (50+ engineers), platform engineering orgs managing monorepos and polyglot systems.

**Competitors**:
- JFrog Artifactory (binary repo, limited dependency governance)
- Snyk (vulnerability scanning only)
- Dependabot/Renovate (automated PRs, not orchestration)
- npm audit (single ecosystem)
- In-house custom systems

**Differentiation**:
- Cross-language support (npm, pip, cargo, maven, gradle, etc.)
- LangGraph workflow orchestration for approval chains
- AI-powered dependency recommendations
- Unified vulnerability scanning across all ecosystems
- Enterprise RBAC and audit logging
- SBOM generation for compliance
- Intelligent conflict resolution

**Business Model**: Open-source foundation + enterprise SaaS tier with orchestration, advanced analytics, and priority support. Target: $50K MRR from enterprise customers.
