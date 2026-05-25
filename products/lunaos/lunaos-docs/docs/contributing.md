# Contributing to Claude Agent Platform

Thank you for your interest in contributing to the Claude Agent Platform! This guide will help you get started with contributing to our open-source project.

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Review Process](#code-review-process)
- [Release Process](#release-process)
- [Community Guidelines](#community-guidelines)

## 🚀 Getting Started

### Prerequisites

Before you begin contributing, ensure you have the following installed:

- **Node.js** 20+ (use [nvm](https://github.com/nvm-sh/nvm) for version management)
- **pnpm** 8+ (package manager)
- **Docker** and **Docker Compose**
- **Git** (configured with your name and email)

### Installation

1. **Fork the repository**
   ```bash
   # Fork the repository on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/platform.git
   cd platform
   ```

2. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/claude-agent/platform.git
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Set up development environment**
   ```bash
   # Copy environment variables
   cp .env.example .env
   
   # Start development services
   pnpm run docker:up
   
   # Install git hooks
   pnpm run setup:hooks
   ```

5. **Verify setup**
   ```bash
   # Run tests to ensure everything is working
   pnpm run test
   pnpm run lint
   pnpm run type-check
   ```

## 🛠️ Development Setup

### Branch Strategy

We use a **Git Flow** branching strategy:

- **`main`**: Production-ready code (protected branch)
- **`develop`**: Integration branch for features
- **`feature/*`**: New features and enhancements
- **`bugfix/*`**: Bug fixes
- **`hotfix/*`**: Critical fixes for production
- **`release/*`**: Release preparation

### Creating a Feature Branch

1. **Sync with upstream**
   ```bash
   git fetch upstream
   git checkout develop
   git merge upstream/develop
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Start development**
   ```bash
   # Start development servers
   pnpm run dev
   ```

### Development Workflow

```bash
# 1. Make your changes
git add .
git commit -m "feat: add your feature description"

# 2. Run tests and quality checks
pnpm run test
pnpm run lint
pnpm run type-check

# 3. Push to your fork
git push origin feature/your-feature-name

# 4. Create Pull Request
# Open GitHub and create a PR from your branch to develop
```

## 📁 Project Structure

Understanding the project structure is crucial for effective contributions:

```
claude-agent-platform/
├── .github/                    # GitHub configuration
│   ├── workflows/             # CI/CD workflows
│   ├── ISSUE_TEMPLATE/        # Issue templates
│   └── PULL_REQUEST_TEMPLATE.md
├── packages/                   # Core packages
│   ├── api/                   # NestJS API server
│   │   ├── src/
│   │   │   ├── auth/         # Authentication
│   │   │   ├── agents/       # Agent management
│   │   │   ├── tasks/        # Task execution
│   │   │   └── config/       # Configuration
│   │   ├── test/             # API tests
│   │   └── package.json
│   ├── database/              # Prisma database
│   │   ├── schema.prisma     # Database schema
│   │   ├── migrations/       # Database migrations
│   │   └── seeds/           # Seed data
│   ├── shared/               # Shared utilities
│   ├── types/                # TypeScript types
│   └── monitoring/           # Observability
├── apps/                      # Applications
│   ├── web/                  # Next.js web app
│   ├── cli/                  # Command-line interface
│   └── deployment/           # Deployment tools
├── luna-agents/              # Luna agents ecosystem
│   ├── agents/              # Individual agents
│   ├── .claude-plugin/      # Claude Code plugin
│   └── mcp-servers/         # MCP servers
├── tools/                    # Development tools
├── docs/                     # Documentation
├── tests/                    # E2E and integration tests
└── infrastructure/           # Infrastructure as code
```

### Where to Make Changes

- **Bug Fixes**: Fix in the appropriate package or app
- **New Features**: Add to relevant package or create new one
- **Documentation**: Update in `docs/` or alongside code changes
- **Tests**: Add tests in `test/` directories of each package
- **Configuration**: Update in relevant config files

## 📝 Coding Standards

### TypeScript Guidelines

We use **strict TypeScript** with comprehensive type coverage:

```typescript
// ✅ Good: Use explicit types
interface UserConfig {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// ✅ Good: Use generics for reusable code
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
}

// ❌ Bad: Avoid 'any' type
function processData(data: any): any {
  return data.processed;
}

// ✅ Good: Use specific types
interface Processable {
  process(): ProcessedData;
}
function processData<T extends Processable>(data: T): ProcessedData {
  return data.process();
}
```

### Code Style

We enforce consistent code style using **ESLint** and **Prettier**:

```typescript
// ✅ Good: Consistent formatting
export class AgentService {
  constructor(
    private readonly repository: AgentRepository,
    private readonly logger: Logger,
  ) {}

  async createAgent(config: AgentConfig): Promise<Agent> {
    try {
      const agent = await this.repository.create(config);
      this.logger.info(`Agent created: ${agent.id}`);
      return agent;
    } catch (error) {
      this.logger.error('Failed to create agent', { error });
      throw new AgentCreationError('Unable to create agent', error);
    }
  }
}
```

### Naming Conventions

- **Files**: kebab-case (`agent-service.ts`, `user-config.ts`)
- **Classes**: PascalCase (`AgentService`, `UserRepository`)
- **Functions/Methods**: camelCase (`createAgent`, `findById`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT`)
- **Interfaces**: PascalCase with 'I' prefix for complex interfaces (`IAgentRepository`)
- **Types**: PascalCase (`UserRole`, `AgentStatus`)

### Error Handling

```typescript
// ✅ Good: Use custom error classes
export class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
    this.name = 'AgentNotFoundError';
  }
}

// ✅ Good: Handle errors gracefully
async function getAgent(id: string): Promise<Agent> {
  try {
    const agent = await agentRepository.findById(id);
    if (!agent) {
      throw new AgentNotFoundError(id);
    }
    return agent;
  } catch (error) {
    if (error instanceof AgentNotFoundError) {
      throw error; // Re-throw domain errors
    }
    logger.error('Unexpected error getting agent', { id, error });
    throw new InternalServerError('Failed to retrieve agent');
  }
}
```

## 🧪 Testing Guidelines

### Test Structure

We follow the **test pyramid** approach:

```
tests/
├── unit/                    # Fast, isolated unit tests
├── integration/             # Component integration tests
├── e2e/                     # End-to-end tests
└── performance/             # Performance and load tests
```

### Writing Tests

#### Unit Tests

```typescript
// agent.service.spec.ts
describe('AgentService', () => {
  let service: AgentService;
  let repository: jest.Mocked<AgentRepository>;
  let logger: jest.Mocked<Logger>;

  beforeEach(() => {
    repository = createMockRepository();
    logger = createMockLogger();
    service = new AgentService(repository, logger);
  });

  describe('createAgent', () => {
    it('should create an agent successfully', async () => {
      // Arrange
      const config: AgentConfig = {
        name: 'Test Agent',
        type: 'task-executor',
        timeout: 30000,
      };
      const expectedAgent = createTestAgent(config);
      repository.create.mockResolvedValue(expectedAgent);

      // Act
      const result = await service.createAgent(config);

      // Assert
      expect(result).toEqual(expectedAgent);
      expect(repository.create).toHaveBeenCalledWith(config);
      expect(logger.info).toHaveBeenCalledWith(
        `Agent created: ${expectedAgent.id}`
      );
    });

    it('should throw AgentCreationError when repository fails', async () => {
      // Arrange
      const config: AgentConfig = {
        name: 'Test Agent',
        type: 'task-executor',
        timeout: 30000,
      };
      const error = new Error('Database error');
      repository.create.mockRejectedValue(error);

      // Act & Assert
      await expect(service.createAgent(config)).rejects.toThrow(
        AgentCreationError
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create agent',
        { error }
      );
    });
  });
});
```

#### Integration Tests

```typescript
// agent.integration.spec.ts
describe('Agent API Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();
  });

  beforeEach(async () => {
    await prisma.cleanDatabase(); // Helper to reset test data
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/agents', () => {
    it('should create an agent', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/agents')
        .send({
          name: 'Test Agent',
          type: 'task-executor',
          config: { timeout: 30000 },
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Test Agent',
        type: 'task-executor',
        status: 'active',
      });
    });
  });
});
```

### Test Requirements

- **Coverage**: Minimum 80% line coverage, 90% for critical paths
- **Assertions**: Every test should have at least one assertion
- **Test Data**: Use factories for test data generation
- **Mocking**: Mock external dependencies, don't mock the code you're testing
- **Cleanup**: Clean up test data in `afterEach` hooks

### Running Tests

```bash
# Run all tests
pnpm run test

# Run specific test file
pnpm run test packages/api/src/agents/agent.service.spec.ts

# Run tests in watch mode
pnpm run test:unit -- --watch

# Run tests with coverage
pnpm run test:coverage

# Run integration tests
pnpm run test:integration

# Run E2E tests
pnpm run test:e2e
```

## 🔄 Pull Request Process

### Before Creating a PR

1. **Ensure tests pass**
   ```bash
   pnpm run test
   pnpm run lint
   pnpm run type-check
   ```

2. **Update documentation**
   - Update README.md if needed
   - Add API documentation for new endpoints
   - Update CHANGELOG.md for user-facing changes

3. **Clean up commits**
   ```bash
   # Interactive rebase to clean up commit history
   git rebase -i HEAD~n
   ```

### Creating a Pull Request

1. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create PR on GitHub**
   - Base: `develop` branch
   - Use descriptive title following [Conventional Commits](https://conventionalcommits.org/)
   - Fill out the PR template completely
   - Link related issues

3. **PR Template**
   ```markdown
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   
   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed
   
   ## Checklist
   - [ ] Code follows project style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] Changes generate no new warnings
   ```

### PR Review Process

1. **Automated Checks**
   - CI/CD pipeline must pass
   - Code coverage requirements met
   - Security scans pass

2. **Code Review**
   - At least one maintainer approval required
   - Address all review comments
   - Update PR based on feedback

3. **Merge**
   - Squash and merge for feature branches
   - Maintainers handle merge to maintain clean history
   - PR is deleted after merge

## 📋 Code Review Process

### Review Guidelines

When reviewing code, focus on:

1. **Correctness**
   - Does the code work as intended?
   - Are there edge cases not handled?
   - Is error handling appropriate?

2. **Performance**
   - Are there performance implications?
   - Is database access optimized?
   - Are algorithms efficient?

3. **Security**
   - Are there security vulnerabilities?
   - Is input validation proper?
   - Are sensitive data handled correctly?

4. **Maintainability**
   - Is code readable and understandable?
   - Are naming conventions followed?
   - Is code structure logical?

5. **Testing**
   - Are tests comprehensive?
   - Do tests cover edge cases?
   - Are test assertions meaningful?

### Review Comments

Use the following guidelines for review comments:

```markdown
# Suggestions
**Suggestion**: Consider using async/await instead of .then() for better readability.

# Questions
**Question**: Why did you choose this approach over the alternative? 

# Issues
**Issue**: This could potentially cause a memory leak if not properly cleaned up.

# Approval
**Approval**: Looks good! The tests cover all edge cases and the implementation is clean.
```

## 📦 Release Process

### Version Management

We use [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Prepare release**
   ```bash
   # Update version
   pnpm run changeset
   pnpm run version
   
   # Update CHANGELOG
   pnpm run changeset changelog
   ```

2. **Create release branch**
   ```bash
   git checkout -b release/v1.2.0
   ```

3. **Final testing**
   ```bash
   pnpm run test
   pnpm run build
   ```

4. **Merge and tag**
   ```bash
   git checkout main
   git merge release/v1.2.0
   git tag v1.2.0
   
   git checkout develop
   git merge release/v1.2.0
   ```

5. **Publish**
   ```bash
   git push origin main --tags
   pnpm run release
   ```

### Release Notes

Generate release notes automatically:

```bash
# Generate release notes
pnpm run changeset changelog

# Or manually using GitHub releases
```

## 🌟 Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please read our [Code of Conduct](CODE_OF_CONDUCT.md) and follow it in all interactions.

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community discussions
- **Discord**: Real-time chat and community support (link in README)

### Getting Help

If you need help contributing:

1. **Check existing issues** and documentation
2. **Search GitHub Discussions** for similar questions
3. **Create a discussion** for general questions
4. **Open an issue** for specific bugs or feature requests

### First-Time Contributors

We welcome first-time contributors! Look for issues labeled `good first issue` to get started:

1. **Find an issue** labeled `good first issue`
2. **Comment** that you'd like to work on it
3. **Follow the setup instructions** above
4. **Ask for help** if you get stuck

### Recognition

Contributors are recognized in several ways:

- **Contributors section** in README
- **Release notes** mention significant contributors
- **Contributor badge** on GitHub profile
- **Annual recognition** for top contributors

## 🎯 Contribution Areas

We welcome contributions in many areas:

### 🤖 Agent Development
- Create new specialized agents
- Improve existing agent capabilities
- Add new agent integrations

### 🧠 AI Integration
- Support for new AI providers
- Enhanced RAG capabilities
- Token optimization improvements

### 📱 Platform Generation
- New app generators (Flutter, .NET, etc.)
- Improved template systems
- Enhanced deployment automation

### 🎨 UI/UX Improvements
- New component designs
- Accessibility enhancements
- Performance optimizations

### 📊 Monitoring and Observability
- New metrics and dashboards
- Enhanced alerting
- Performance monitoring

### 📚 Documentation
- Improve existing documentation
- Add tutorials and guides
- Translate documentation

### 🧪 Testing
- Improve test coverage
- Add new test types
- Performance testing

### 🔧 DevOps and Infrastructure
- CI/CD improvements
- Deployment automation
- Infrastructure enhancements

## 📞 Getting Help

If you need help with contributing:

1. **Check the documentation** first
2. **Search existing issues** and discussions
3. **Join our Discord community**
4. **Create a discussion** for questions
5. **Contact maintainers** for urgent issues

## 🙏 Thank You

Thank you for contributing to the Claude Agent Platform! Your contributions help make this project better for everyone. We appreciate your time and effort in improving our open-source project.

---

Happy contributing! 🎉