# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Questro is an enterprise-grade SaaS testing automation platform with AI-powered test recording for mobile (iOS/Android) and web applications. It uses a hybrid cloud-agent architecture combining cloud orchestration with local device control.

## Common Development Commands

### Setup and Installation
```bash
# Initial setup (installs deps, sets up DB, builds Docker)
npm run setup

# Install dependencies for all workspaces
npm run setup:deps
```

### Development
```bash
# Start all services (frontend, backend, Docker)
npm run dev

# Start individual services
npm run dev:frontend  # Runs on port 3000
npm run dev:backend   # Runs with tsx watch
npm run dev:docker    # Starts Docker containers

# Database management
cd backend && npm run db:migrate    # Run migrations
cd backend && npm run db:generate   # Generate schema
cd backend && npm run db:studio     # Open Drizzle Studio
```

### Testing
```bash
# Run all tests
npm test

# Run tests by service
npm run test:frontend
npm run test:backend

# Run specific test types (backend)
cd backend && npm run test:unit          # Unit tests only
cd backend && npm run test:integration   # Integration tests only
cd backend && npm run test:controllers   # Controller tests only
cd backend && npm run test:ci           # CI mode with coverage

# Watch mode and coverage
cd frontend && npm run test:watch
cd backend && npm run test:coverage

# Frontend testing with Vitest
cd frontend && npm run test:ui          # Test UI interface
cd frontend && npm run test:components  # Component tests only
cd frontend && npm run test:pages      # Page tests only
cd frontend && npm run test:ci         # CI mode with coverage
```

### Code Quality
```bash
# Lint all code
npm run lint

# Fix linting issues
cd frontend && npm run lint:fix
cd backend && npm run lint:fix

# Type checking
cd frontend && npm run type-check
cd backend && npm run type-check

# Format code
cd frontend && npm run format
cd backend && npm run format
```

### Building and Deployment
```bash
# Build for production
npm run build

# Deploy to environments
npm run deploy:dev     # Development
npm run deploy:staging # Staging
npm run deploy:prod    # Production

# Render deployment (uses render.yaml)
git push origin main   # Auto-deploys via Render

# Database seeding
cd backend && npm run db:seed

# Development utilities
npm run logs           # View all container logs
npm run logs:backend   # Backend logs only
npm run logs:frontend  # Frontend logs only
npm run clean          # Clean all dependencies and Docker
npm run security:scan  # Security audit
```

## High-Level Architecture

### Hybrid Cloud-Agent Model
The platform uses a unique architecture combining cloud services with local agents:

1. **Cloud Platform** (React + Node.js)
   - User interface and orchestration
   - Test management and storage
   - Real-time WebSocket communication
   - API endpoints for integrations

2. **Local Agent** (Cross-platform executable)
   - Device control and interaction
   - Maestro integration for mobile
   - workflow-use integration for web
   - Secure bidirectional communication

3. **Communication Layer**
   - WebSocket for real-time updates
   - JWT authentication
   - Encrypted data transmission
   - Agent heartbeat monitoring

### Technology Stack

**Frontend** (`/frontend`)
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Zustand for state management
- React Query for data fetching
- Socket.io-client for real-time features
- Vitest for testing (instead of Jest)
- Monaco Editor for code editing
- Framer Motion for animations

**Backend** (`/backend`)
- Node.js with Express (ES modules)
- PostgreSQL with Drizzle ORM
- Redis for caching/queues
- Socket.io for WebSocket
- JWT authentication
- Bull for job queues
- tsx for TypeScript execution
- Jest for testing

**Testing Integrations**
- Maestro for mobile testing (iOS/Android)
- workflow-use for web browser automation
- Universal test format conversion (YAML/JSON)

**Deployment**
- Docker containers for local development
- Render.com for production hosting
- Supabase for managed PostgreSQL
- Netlify for static site hosting (alternative)

### Key Services and Components

**Recording Services** (`/backend/src/services/`)
- `RecordingService.ts` - Core recording orchestration
- `WebRecordingService.ts` - Web-specific recording
- `VoiceService.ts` - Voice command integration
- `AIService.ts` - AI-powered test generation
- `CloudTestingService.ts` - Cloud-based test execution
- `PluginDatabaseService.ts` - Plugin system management
- `AssertionSuggestionService.ts` - AI assertion suggestions
- `SmartSelectorService.ts` - Intelligent element selection
- `ParameterizationService.ts` - Test data parameterization
- `ReportingService.ts` - Analytics and reporting
- `SubscriptionService.ts` - Subscription management
- `NotificationService.ts` - Multi-channel notifications
- `PerformanceTestService.ts` - Performance testing capabilities
- `EmailService.ts` - Email notifications
- `StripeService.ts` - Payment processing
- `LemonSqueezyService.ts` - Alternative payment processing
- `SchedulingService.ts` - Test scheduling and cron jobs
- `TestExportService.ts` - Test export functionality

**Agent Service** (`/agent/src/`)
- `AgentService.ts` - Local agent implementation
- Real-time device control
- Test execution engine

**Frontend Pages** (`/frontend/src/pages/`)
- `RecordingStudio.tsx` - Main recording interface
- `APIManagementPage.tsx` - API testing
- `DataTestingPage.tsx` - Data-driven testing
- `AITestGenerationPage.tsx` - AI test generation
- `ScheduledTestsPage.tsx` - Test scheduling
- `ReportsPage.tsx` - Analytics and reporting
- `VoiceTestingLandingPage.tsx` - Voice-based testing
- `SecurityTestingLandingPage.tsx` - Security testing features

### AI Integration Strategy

The platform integrates multiple AI providers:
- **OpenAI GPT-4/3.5** - Natural language test generation
- **Hugging Face Models** - Specialized testing models
- **MCP Servers** - Custom AI testing capabilities
- **Usage Tracking** - Plan-based AI limits

All AI features include:
- Cost optimization with caching
- Privacy-first design (no data retention)
- Multi-model routing for best results
- Real-time streaming responses

### Database Schema

Uses Drizzle ORM with PostgreSQL:
- Schema definitions in `/backend/src/schema/`
- Migrations managed via `drizzle-kit`
- Supabase for production database
- Row-level security policies

### Security Considerations

- JWT authentication with refresh tokens
- RBAC for team permissions
- Encrypted agent communication
- Audit logging for all actions
- CORS configuration for API access
- Environment-based secrets management

### Testing Strategy

- **Unit Tests**: Jest for backend, Vitest for frontend
- **Integration Tests**: API and WebSocket testing
- **E2E Tests**: Using the platform itself (dogfooding)
- **Performance Tests**: Custom load testing service
- **Security Scanning**: Automated vulnerability checks
- **Test Organization**: Separate test directories for controllers, services, components, and pages

### Real-time Features

WebSocket events for live updates:
- `recording:started` - Recording session began
- `recording:action` - New action recorded
- `recording:completed` - Recording finished
- `test:running` - Test execution started
- `test:completed` - Test execution finished

### Environment Variables

Key environment variables to configure:
```bash
# Database
DATABASE_URL=postgresql://...
USE_SUPABASE=true

# Authentication  
JWT_SECRET=...

# Features
ENABLE_RECORDING=true
ENABLE_MOBILE_TESTING=true
ENABLE_WEB_TESTING=true

# Integrations
SLACK_WEBHOOK_URL=...
FRONTEND_URL=https://...
```

See backend `.env.example` for full list.

### Important Patterns

1. **Agent-First Design** - Always consider agent-cloud communication
2. **Real-time Updates** - Use WebSocket for live feedback
3. **Universal Formats** - Maintain mobile/web test compatibility
4. **Plan-Based Limits** - Track AI and feature usage by plan
5. **Multi-Platform Support** - Ensure features work across platforms