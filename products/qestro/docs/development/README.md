# Development Documentation

Development guides, best practices, and troubleshooting resources for Questro contributors and maintainers.

## Development Overview

This section contains essential information for developers working on the Questro platform, including setup guides, coding standards, and troubleshooting resources.

## Documentation Index

### ⚙️ [Environment Setup Guide](./environment-setup-guide.md)
Comprehensive guide for setting up your development environment with all necessary tools and dependencies.

### 🔧 [Build Fix Complete](./build-fix-complete.md)
Documentation of build system fixes and optimizations implemented in the project.

### 🗄️ [Database Connection Fix](./database-connection-fix.md)
Solutions and fixes for database connectivity issues during development.

### 📦 [ESM Import Fix Complete](./esm-import-fix-complete.md)
Resolution of ES Module import issues and configuration updates.

### 💻 [Professional CLI](./professional-cli.md)
Command-line interface tools and utilities for professional development workflows.

## Development Environment

### Prerequisites
- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **PostgreSQL**: Version 14 or higher
- **Redis**: Version 6 or higher
- **Git**: Latest version

### IDE Recommendations
- **VS Code**: With recommended extensions
- **WebStorm**: Full-featured IDE option
- **Vim/Neovim**: For terminal-based development

### Recommended Extensions (VS Code)
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- GitLens
- Thunder Client (API testing)
- PostgreSQL (database management)

## Development Workflow

### 1. Project Setup
```bash
# Clone the repository
git clone https://github.com/your-org/questro.git
cd questro

# Install dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Environment Configuration
```bash
# Copy environment templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Configure your local settings
```

### 3. Database Setup
```bash
# Start PostgreSQL and Redis
# Run database migrations
cd backend
npm run db:migrate
npm run db:seed
```

### 4. Development Servers
```bash
# Start all services
npm run dev

# Or start individually
npm run dev:backend    # Port 3001
npm run dev:frontend   # Port 3000
npm run dev:agent      # Port 3002
```

## Code Standards

### TypeScript Configuration
- **Strict Mode**: Enabled for type safety
- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting
- **Path Mapping**: Absolute imports with path aliases

### Naming Conventions
- **Files**: kebab-case for files and directories
- **Variables**: camelCase for variables and functions
- **Constants**: UPPER_SNAKE_CASE for constants
- **Components**: PascalCase for React components
- **Types**: PascalCase for TypeScript types/interfaces

### Code Organization
```
src/
├── components/        # Reusable UI components
├── pages/            # Page components
├── hooks/            # Custom React hooks
├── services/         # API and business logic
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
├── constants/        # Application constants
└── __tests__/        # Test files
```

## Testing Guidelines

### Test Structure
- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Best Practices
- Write tests before implementing features (TDD)
- Use descriptive test names
- Keep tests isolated and independent
- Mock external dependencies
- Maintain high test coverage (>80%)

## Debugging

### Backend Debugging
- **VS Code Debugger**: Configured launch settings
- **Console Logging**: Structured logging with Winston
- **Database Queries**: Query logging and analysis
- **API Testing**: Thunder Client or Postman

### Frontend Debugging
- **React DevTools**: Component inspection
- **Redux DevTools**: State management debugging
- **Browser DevTools**: Network and performance analysis
- **Error Boundaries**: Graceful error handling

## Performance Optimization

### Backend Performance
- **Database Indexing**: Optimize database queries
- **Caching**: Implement Redis caching
- **Connection Pooling**: Efficient database connections
- **Async Operations**: Non-blocking operations

### Frontend Performance
- **Code Splitting**: Lazy loading of components
- **Bundle Analysis**: Webpack bundle analyzer
- **Image Optimization**: Optimized image formats
- **Caching**: Browser and service worker caching

## Git Workflow

### Branch Strategy
- **main**: Production-ready code
- **develop**: Integration branch
- **feature/***: Feature development
- **hotfix/***: Critical bug fixes

### Commit Messages
Follow Conventional Commits specification:
```
type(scope): description

feat(auth): add JWT token validation
fix(api): resolve database connection issue
docs(readme): update installation instructions
```

### Pull Request Process
1. Create feature branch from develop
2. Implement changes with tests
3. Run full test suite
4. Create pull request with description
5. Code review and approval
6. Merge to develop

## Common Issues and Solutions

### Build Issues
- **Node Version**: Ensure correct Node.js version
- **Dependencies**: Clear node_modules and reinstall
- **TypeScript**: Check TypeScript configuration
- **Environment**: Verify environment variables

### Database Issues
- **Connection**: Check database connection string
- **Migrations**: Run pending migrations
- **Permissions**: Verify database user permissions
- **Port Conflicts**: Check for port conflicts

### Development Server Issues
- **Port Conflicts**: Change default ports if needed
- **Hot Reload**: Restart development server
- **Cache Issues**: Clear browser and build cache
- **CORS**: Configure CORS for local development

## Tools and Utilities

### Development Tools
- **Nodemon**: Automatic server restart
- **Concurrently**: Run multiple commands
- **Cross-env**: Cross-platform environment variables
- **Husky**: Git hooks for quality checks

### Database Tools
- **Drizzle Studio**: Database GUI
- **pgAdmin**: PostgreSQL administration
- **Redis CLI**: Redis command-line interface
- **Database Migrations**: Automated schema management

### API Development
- **Thunder Client**: VS Code API client
- **Postman**: API testing and documentation
- **Swagger**: API documentation generation
- **OpenAPI**: API specification

## Contributing Guidelines

### Before Contributing
1. Read the contributing guidelines
2. Set up development environment
3. Run tests to ensure everything works
4. Create feature branch for changes

### Code Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No breaking changes without discussion
- [ ] Performance impact considered

### Getting Help
- **Documentation**: Check existing documentation first
- **Issues**: Search existing GitHub issues
- **Discussions**: Use GitHub discussions for questions
- **Code Review**: Ask for help in pull requests

---

For specific development setup instructions, start with the [Environment Setup Guide](./environment-setup-guide.md).