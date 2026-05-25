# Development Scripts

Scripts for local development, building, and running Questro.

## Available Scripts

### Application Lifecycle
- **`start.sh`** - Start all development services
- **`stop.sh`** - Stop all running services
- **`start-dev.sh`** - Start development servers with hot reload

### Building and Running
- **`build-and-run.sh`** - Build and run the complete application
- **`frontend-build.sh`** - Build frontend application only
- **`quick-start.sh`** - Quick development environment setup

### Demo and Testing
- **`demo.sh`** - Run demo scenarios and examples
- **`launch-questro.sh`** - Launch Questro platform with full setup

## Usage Examples

### Starting Development
```bash
# Quick start for development
./scripts/development/quick-start.sh

# Start all services
./scripts/development/start.sh

# Start with hot reload
./scripts/development/start-dev.sh
```

### Building
```bash
# Build and run everything
./scripts/development/build-and-run.sh

# Build frontend only
./scripts/development/frontend-build.sh
```

### Demo and Testing
```bash
# Run demo scenarios
./scripts/development/demo.sh

# Launch full platform
./scripts/development/launch-questro.sh
```

### Stopping Services
```bash
# Stop all services
./scripts/development/stop.sh
```

## Development Environment

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- npm or yarn

### Environment Setup
1. Copy environment template: `cp .env.example .env`
2. Configure database connection
3. Set up required API keys
4. Run initial setup: `./scripts/setup/quick-setup.sh`

### Port Configuration
Default development ports:
- Frontend: 3000
- Backend: 3001
- Agent: 3002
- Database: 5432
- Redis: 6379

### Hot Reload
Development servers support hot reload for:
- Frontend React components
- Backend API routes
- TypeScript compilation
- CSS/SCSS changes

## Troubleshooting

### Common Issues
- **Port conflicts**: Check if ports are already in use
- **Database connection**: Verify PostgreSQL is running
- **Environment variables**: Ensure all required vars are set
- **Dependencies**: Run `npm install` in all directories

### Debug Mode
Enable debug logging:
```bash
DEBUG=* ./scripts/development/start.sh
```

### Clean Restart
```bash
# Stop all services
./scripts/development/stop.sh

# Clean node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Restart
./scripts/development/start.sh
```