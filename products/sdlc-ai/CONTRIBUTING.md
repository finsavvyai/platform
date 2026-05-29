# Contributing to SDLC.ai

Thank you for your interest in contributing to SDLC.ai! This guide will help you understand how to contribute effectively to our open-source project.

## 🎯 Our Contribution Philosophy

We welcome contributions that:
- Improve the platform's security and reliability
- Enhance developer experience
- Add valuable features for our users
- Fix bugs and performance issues
- Improve documentation and examples

## 🚀 Getting Started

### 1. Prerequisites

Before contributing, ensure you have:
- Read our [Code of Conduct](./CODE_OF_CONDUCT.md)
- Set up the [development environment](./docs/quick-start.md)
- Familiarity with our tech stack (Go, Python, Rust, TypeScript)

### 2. Fork and Clone

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/platform.git
cd platform

# Add upstream remote
git remote add upstream https://github.com/sdlc-ai/platform.git

# Verify remotes
git remote -v
```

### 3. Set Up Development Environment

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development environment
npm run docker:dev
```

## 📝 Development Workflow

### 1. Create an Issue

Before starting work:
1. Check if an issue already exists
2. Create a new issue with clear description
3. Discuss the approach with maintainers
4. Get assigned to the issue

### 2. Create a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name

# Or bugfix branch
git checkout -b fix/issue-number-description
```

### 3. Make Your Changes

Follow our [development guidelines](./docs/development/code-standards.md):

```bash
# Run linting
npm run lint

# Run tests
npm run test

# Run security scan
npm run security:scan

# Format code
npm run format
```

### 4. Commit Your Changes

Use conventional commits:

```bash
# Feature
git commit -m "feat: add support for PDF document processing"

# Bugfix
git commit -m "fix: resolve memory leak in vector indexing"

# Documentation
git commit -m "docs: update API documentation for RAG endpoints"

# Style
git commit -m "style: format Go code according to project standards"

# Refactor
git commit -m "refactor: improve database connection pooling"

# Test
git commit -m "test: add integration tests for authentication flow"

# Chore
git commit -m "chore: update dependencies to latest versions"
```

### 5. Create Pull Request

1. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Create a Pull Request on GitHub with:
   - Clear title and description
   - Reference to related issues
   - Testing instructions
   - Screenshots if applicable

## 🏗️ Project Structure

```
sdlc-platform/
├── services/                 # Microservices
│   ├── gateway/             # Go API Gateway
│   │   ├── cmd/             # Application entry points
│   │   ├── internal/        # Private application code
│   │   ├── pkg/             # Public library code
│   │   └── api/             # API definitions
│   ├── rag/                 # Python RAG Service
│   │   ├── app/             # Application modules
│   │   ├── core/            # Core business logic
│   │   ├── tests/           # Test files
│   │   └── config/          # Configuration
│   ├── vector-core/         # Rust Vector Engine
│   │   ├── src/             # Source code
│   │   ├── tests/           # Test files
│   │   └── config/          # Configuration
│   └── admin-ui/            # Next.js Admin Dashboard
│       ├── src/             # Source code
│       ├── pages/           # Next.js pages
│       ├── components/      # React components
│       └── styles/          # CSS/SCSS files
├── shared/                  # Shared libraries and configs
├── config/                  # Configuration files
├── deployments/             # Deployment manifests
├── tests/                   # Test suites
├── docs/                    # Documentation
└── scripts/                 # Utility scripts
```

## 🧪 Testing Guidelines

### Test Requirements

All contributions must include:
- **Unit tests** for new functionality
- **Integration tests** for API changes
- **Documentation updates** for user-facing changes

### Test Structure

```bash
# Go (Gateway)
services/gateway/internal/auth/
├── auth.go
├── auth_test.go
└── mocks/
    └── mock_provider.go

# Python (RAG)
services/rag/app/core/
├── document_processor.py
├── test_document_processor.py
└── fixtures/
    └── sample_documents/

# Rust (Vector Core)
services/vector-core/src/
├── embedding/
│   ├── mod.rs
│   ├── tests.rs
│   └── mocks.rs
└── lib.rs

# TypeScript (Admin UI)
services/admin-ui/src/components/
├── PolicyEditor/
│   ├── PolicyEditor.tsx
│   ├── PolicyEditor.test.tsx
│   └── PolicyEditor.stories.tsx
```

### Running Tests

```bash
# All tests
npm run test

# Specific service tests
npm run test:gateway
npm run test:rag
npm run test:vector
npm run test:admin

# Integration tests
docker-compose -f docker-compose.test.yml up

# Performance tests
cd tests/performance && k6 run load-test.js
```

## 📏 Code Standards

### Go (Gateway Service)

```go
// Use meaningful variable names
func (s *AuthService) ValidateToken(ctx context.Context, token string) (*UserContext, error) {
    // Always handle errors
    if token == "" {
        return nil, ErrEmptyToken
    }
    
    // Use structured logging
    logger.Info("validating token", "user_id", userID)
    
    // Return early on error
    claims, err := s.parser.Parse(token)
    if err != nil {
        return nil, fmt.Errorf("failed to parse token: %w", err)
    }
    
    return s.buildUserContext(claims), nil
}
```

### Python (RAG Service)

```python
# Use type hints
async def process_document(
    self, 
    document: DocumentData, 
    user_context: UserContext
) -> ProcessedDocument:
    """Process a document and extract content."""
    try:
        # Validate inputs
        if not document.content:
            raise ValueError("Document content cannot be empty")
        
        # Process document
        chunks = await self.chunk_document(document)
        embeddings = await self.generate_embeddings(chunks)
        
        return ProcessedDocument(
            chunks=chunks,
            embeddings=embeddings,
            metadata=document.metadata
        )
    except Exception as e:
        logger.error(f"Document processing failed: {e}")
        raise
```

### Rust (Vector Core)

```rust
// Use Result types for error handling
pub async fn generate_embedding(
    &self,
    text: &str,
    model: &EmbeddingModel,
) -> Result<Vec<f32>, EmbeddingError> {
    // Validate inputs
    if text.is_empty() {
        return Err(EmbeddingError::EmptyInput);
    }
    
    // Generate embedding
    let embedding = self
        .provider
        .generate(text, model)
        .await
        .map_err(EmbeddingError::ProviderError)?;
    
    Ok(embedding)
}
```

### TypeScript (Admin UI)

```typescript
// Use interfaces and proper typing
interface Policy {
  id: string;
  name: string;
  description: string;
  regoPolicy: string;
  isActive: boolean;
}

// Use React hooks properly
export function PolicyEditor({ policy, onChange }: PolicyEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updatePolicy(policy);
      onChange(policy);
    } catch (error) {
      console.error('Failed to save policy:', error);
    } finally {
      setIsSaving(false);
    }
  }, [policy, onChange]);
  
  return (
    <div className="policy-editor">
      {/* Component content */}
    </div>
  );
}
```

## 🔒 Security Guidelines

### Security Requirements

All contributions must:
- Pass security scanning (`npm run security:scan`)
- Follow secure coding practices
- Not introduce new vulnerabilities
- Include security considerations for new features

### Common Security Issues to Avoid

```go
// ❌ Never hardcode secrets
apiKey := "sk-1234567890"

// ✅ Use environment variables
apiKey := os.Getenv("API_KEY")

// ❌ Never use string concatenation for SQL
query := "SELECT * FROM users WHERE id = " + userID

// ✅ Use parameterized queries
query := "SELECT * FROM users WHERE id = $1"
```

## 📖 Documentation Standards

### What to Document

- New features and APIs
- Configuration changes
- Breaking changes
- Security considerations
- Performance implications

### Documentation Format

```markdown
# Feature Name

Brief description of the feature.

## Usage

```bash
# Command examples
curl -X POST http://localhost:8080/api/v1/feature \
  -H "Content-Type: application/json" \
  -d '{"param": "value"}'
```

## Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| feature_enabled | boolean | false | Enable the feature |

## Security Considerations

- Authentication required
- Rate limiting applies
- Audit logging enabled
```

## 🚀 Release Process

### Version Bumping

We use semantic versioning:
- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes (backward compatible)

### Release Checklist

1. All tests passing
2. Documentation updated
3. CHANGELOG.md updated
4. Security scan passed
5. Performance tests passed
6. Release notes prepared

## 🏆 Types of Contributions

### Code Contributions

- **Bug fixes**: Address reported issues
- **Features**: Add new functionality
- **Performance**: Improve speed and efficiency
- **Security**: Enhance security measures
- **Refactoring**: Improve code structure

### Non-Code Contributions

- **Documentation**: Improve guides and docs
- **Testing**: Add test coverage
- **Design**: UI/UX improvements
- **Infrastructure**: DevOps and deployment
- **Community**: Support and outreach

## 🤝 Review Process

### Pull Request Review

All PRs require:
1. **Technical Review**: Code quality and correctness
2. **Security Review**: Security implications
3. **Documentation Review**: Completeness and accuracy
4. **Testing Review**: Test coverage and quality

### Review Criteria

- [ ] Code follows project standards
- [ ] Tests are comprehensive and passing
- [ ] Documentation is updated
- [ ] Security considerations addressed
- [ ] Performance impact considered
- [ ] Breaking changes documented

### Merge Requirements

- At least one maintainer approval
- All CI/CD checks passing
- No merge conflicts
- Documentation updated

## 🎁 Recognition

### Contributor Recognition

- Contributors list in README
- Annual contributor awards
- Swag for significant contributions
- Speaking opportunities at events

### Becoming a Maintainer

Consistent, high-quality contributions can lead to:
- Review privileges
- Merge permissions
- Project leadership roles
- Decision-making authority

## 🆘 Getting Help

### Resources

- [Documentation](./docs/)
- [GitHub Issues](https://github.com/sdlc-ai/platform/issues)
- [GitHub Discussions](https://github.com/sdlc-ai/platform/discussions)
- [Discord Community](https://discord.gg/sdlc)

### Contact Options

- **Questions**: Use GitHub Discussions
- **Bug Reports**: Create GitHub Issue
- **Security Issues**: Email security@sdlc.ai
- **General**: Email support@sdlc.ai

## 📋 Checklist for Contributors

Before submitting a PR:

- [ ] I have read the contribution guidelines
- [ ] My code follows the project standards
- [ ] I have performed a self-review
- [ ] I have added tests for my changes
- [ ] I have updated documentation
- [ ] All tests are passing locally
- [ ] Security scan passes
- [ ] My PR description is clear and complete
- [ ] I have linked relevant issues

Thank you for contributing to SDLC.ai! 🎉

---

For questions about contributing, contact us at contributors@sdlc.ai