# Developer Guide Table of Contents

This is the complete table of contents for the MCPOverflow Developer Documentation.

## 📚 Developer Guide Contents

### Getting Started

- [Getting Started Guide](./getting-started.md)
  - Prerequisites and setup
  - Project architecture overview
  - Running the application locally
  - Making your first contribution
  - Development best practices

### Architecture

- [Architecture Overview](./architecture.md)
  - System architecture diagram
  - Frontend architecture (React/Vite)
  - Backend architecture (Supabase)
  - Database design and relationships
  - Security architecture
  - API design principles

### Database Development

- [Database Development Guide](./database.md)
  - Database schema overview
  - Migration procedures
  - RLS policy development
  - Database functions
  - Performance optimization
  - Testing database changes

### API Development

- [API Development Guide](./api-development.md)
  - API architecture overview
  - Authentication and authorization
  - Endpoint development
  - Error handling patterns
  - Security implementation
  - API testing strategies

### Security

- [Security Guide](./security.md)
  - Security architecture overview
  - Authentication implementation
  - Input validation and sanitization
  - CSRF protection
  - Rate limiting
  - Security testing

### Testing

- [Testing Guide](./testing.md)
  - Testing strategy overview
  - Unit testing with Vitest
  - Integration testing
  - E2E testing
  - Database testing
  - Performance testing

### Performance

- [Performance Guide](./performance.md)
  - Performance optimization strategies
  - Frontend performance
  - Backend performance
  - Database optimization
  - Monitoring and profiling
  - Caching strategies

### Deployment

- [Deployment Guide](./deployment.md)
  - Deployment architecture
  - CI/CD pipeline setup
  - Environment management
  - Production deployment
  - Rollback procedures
  - Infrastructure as code

## 🚀 Quick Navigation

### New Contributors

1. Start with [Getting Started Guide](./getting-started.md)
2. Understand the [Architecture Overview](./architecture.md)
3. Learn about [Database Development](./database.md)
4. Follow [Security Guidelines](./security.md)
5. Review [Testing Guide](./testing.md)

### Experienced Developers

1. Review [Architecture Overview](./architecture.md)
2. Study [API Development Guide](./api-development.md)
3. Implement [Security Best Practices](./security.md)
4. Optimize with [Performance Guide](./performance.md)
5. Deploy with [Deployment Guide](./deployment.md)

### Database Developers

1. Start with [Database Development Guide](./database.md)
2. Review migration procedures
3. Understand RLS policies
4. Optimize queries and indexes
5. Test database changes

### Security Engineers

1. Study [Security Guide](./security.md)
2. Review authentication implementation
3. Audit security controls
4. Implement security testing
5. Monitor security events

## 📖 Additional Resources

### User Documentation

For end-user documentation, see the [User Guide](../user-guide/table-of-contents.md)

### API Documentation

For API reference, see the [API Documentation](../api/overview.md)

### Operations Documentation

For deployment and operations, see the [Operations Documentation](../operations/table-of-contents.md)

## 🛠️ Development Tools

### Required Tools

- **Node.js** 18+ - JavaScript runtime
- **npm** or **pnpm** - Package manager
- **Git** - Version control
- **VS Code** - Code editor (recommended)

### Optional Tools

- **Docker** - Containerization
- **PostgreSQL** - Local database
- **Supabase CLI** - Database management
- **Vercel CLI** - Deployment

### VS Code Extensions

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Type checking
- **GitLens** - Git integration
- **Thunder Client** - API testing

## 📋 Development Workflow

### 1. Setup Environment

```bash
git clone https://github.com/mcpoverflow/mcpoverflow.git
cd mcpoverflow
npm install
cp .env.example .env.local
```

### 2. Run Locally

```bash
npm run dev
```

### 3. Make Changes

- Follow coding standards
- Add tests for new functionality
- Update documentation

### 4. Test Changes

```bash
npm run test
npm run typecheck
npm run lint
```

### 5. Submit PR

- Create feature branch
- Submit pull request
- Address feedback

## 🔍 Code Quality

### Standards

- **TypeScript** for type safety
- **ESLint** for code quality
- **Prettier** for formatting
- **Husky** for git hooks

### Testing Requirements

- Unit tests for all functions
- Integration tests for API endpoints
- E2E tests for critical flows
- Performance tests for bottlenecks

### Documentation Requirements

- README for all components
- API documentation for endpoints
- Database documentation for schemas
- Architecture documentation for designs

## 🚨 Common Issues

### Environment Setup

- Ensure Node.js 18+ is installed
- Verify Supabase CLI configuration
- Check environment variables

### Database Issues

- Run database migrations
- Verify RLS policies
- Check connection strings

### Build Issues

- Clear build cache
- Update dependencies
- Check TypeScript errors

## 📞 Getting Help

### Documentation

- Browse these guides first
- Check existing issues
- Review code examples

### Community

- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and share ideas
- **Discord** (if available): Real-time chat with community

### Direct Support

- **Email**: dev@mcpoverflow.com
- **Issues**: Create detailed bug reports
- **Discussions**: Ask technical questions

## 📊 Contributing Statistics

### Project Health

- **Open Issues**: Track bugs and features
- **Pull Requests**: Review and merge contributions
- **Code Coverage**: Maintain test coverage
- **Documentation**: Keep docs up to date

### Recognition

- Contributors are acknowledged in releases
- Top contributors receive special recognition
- Community contributions are celebrated

---

Ready to contribute? Check our [Good First Issues](https://github.com/mcpoverflow/mcpoverflow/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) and get started!

Last updated: November 2, 2025
Documentation version: 1.0
