# Code Review Checklist

## Review Categories

### 1. Code Quality Review ✅

#### Code Structure
- [ ] Code follows project architectural patterns
- [ ] Functions/classes have single responsibility
- [ ] Code is DRY (Don't Repeat Yourself)
- [ ] Abstractions are appropriate
- [ ] Coupling is minimized
- [ ] Cohesion is high

#### Naming and Conventions
- [ ] Names are descriptive and meaningful
- [ ] Follows language-specific conventions
- [ ] No abbreviations unless widely understood
- [ ] Booleans are prefixed with is/has/can
- [ ] Collections use plural nouns

#### Comments and Documentation
- [ ] Complex logic has comments explaining why
- [ ] Public APIs have documentation
- [ ] TODO/FIXME comments have tickets
- [ ] Commented code is removed
- [ ] Documentation is up-to-date

#### Error Handling
- [ ] Errors are handled appropriately
- [ ] Error messages are descriptive
- [ ] Failures are logged
- [ ] No silent failures
- [ ] Cleanup in finally blocks where needed

#### Performance
- [ ] Algorithms are efficient
- [ ] Database queries are optimized
- [ ] No unnecessary computations
- [ ] Caching used where appropriate
- [ ] Memory usage is reasonable

### 2. Security Review 🔒

#### Authentication & Authorization
- [ ] Authentication checks are present
- [ ] Authorization checks are correct
- [ ] Principle of least privilege applied
- [ ] Session management is secure
- [ ] Password policies enforced

#### Input Validation
- [ ] All inputs are validated
- [ ] White-listing used over black-listing
- [ ] SQL injection prevented
- [ ] XSS protection implemented
- [ ] CSRF tokens used

#### Data Protection
- [ ] Sensitive data is encrypted at rest
- [ ] Sensitive data is encrypted in transit
- [ ] No hardcoded secrets
- [ ] Logs don't contain sensitive data
- [ ] PII is properly handled

#### Dependency Security
- [ ] Dependencies are up-to-date
- [ ] No known vulnerabilities
- [ ] License compliance verified
- [ ] Third-party services are secure

#### Infrastructure Security
- [ ] Environment variables used for secrets
- [ ] Network security configured
- [ ] Container security implemented
- [ ] Monitoring for security events

### 3. Testing Review 🧪

#### Test Coverage
- [ ] Unit tests added for new code
- [ ] Coverage meets requirements (>95%)
- [ ] Tests are meaningful and not just for coverage
- [ ] Edge cases are tested
- [ ] Error conditions are tested

#### Test Quality
- [ ] Tests are independent
- [ ] Tests are deterministic
- [ ] Test data is realistic
- [ ] Test names are descriptive
- [ ] Tests follow AAA pattern

#### Integration Tests
- [ ] Service interactions tested
- [ ] Database integration tested
- [ ] External API integrations tested
- [ ] Error scenarios tested

#### Test Maintenance
- [ ] Tests are maintainable
- [ ] Test utilities used appropriately
- [ ] No flaky tests
- [ ] Test performance is acceptable

### 4. Performance Review 📊

#### Response Time
- [ ] API responses are under limits (<500ms p95)
- [ ] Database queries are efficient
- [ ] No N+1 query problems
- [ ] Caching strategies implemented
- [ ] Async operations used where appropriate

#### Resource Usage
- [ ] Memory usage is optimized
- [ ] CPU usage is reasonable
- [ ] Network calls minimized
- [ ] File I/O is optimized
- [ ] Connection pooling used

#### Scalability
- [ ] Can handle expected load
- [ ] Horizontal scaling considered
- [ ] Rate limiting implemented
- [ ] Circuit breakers implemented
- [ ] Queue usage for async tasks

### 5. Documentation Review 📚

#### Code Documentation
- [ ] Public APIs documented
- [ ] Complex algorithms explained
- [ ] Configuration options documented
- [ ] Usage examples provided

#### README/Documentation
- [ ] README updated if needed
- [ ] Installation instructions clear
- [ ] Usage examples work
- [ ] Troubleshooting section updated

#### API Documentation
- [ ] OpenAPI specs updated
- [ ] Request/response examples
- [ ] Error codes documented
- [ ] Authentication methods documented

### 6. Compatibility Review 🔄

#### Breaking Changes
- [ ] Breaking changes identified
- [ ] Migration path provided
- [ ] Versioning strategy clear
- [ ] Backward compatibility considered

#### Dependencies
- [ ] Dependency updates justified
- [ ] Conflicts resolved
- [ ] Minimum versions specified
- [ ] Optional dependencies clearly marked

### 7. Operational Review 🛠️

#### Monitoring & Logging
- [ ] Appropriate logging added
- [ ] Log levels correct
- [ ] Metrics exposed
- [ ] Health checks implemented
- [ ] Error reporting configured

#### Deployment
- [ ] Deployment instructions clear
- [ ] Environment variables documented
- [ ] Database migrations included
- [ ] Rollback plan exists

## Review Process

### Before Review
1. Run code locally
2. Check automated test results
3. Read PR description carefully
4. Understand the context

### During Review
1. Review diff systematically
2. Leave constructive feedback
3. Ask questions for clarity
4. Suggest improvements
5. Verify understanding

### After Review
1. Leave summary comment
2. Approve if ready
3. Request changes if needed
4. Follow up on discussions

## Review Guidelines

### Giving Feedback
- Be specific and actionable
- Explain why something needs change
- Provide suggestions for improvement
- Use a friendly, collaborative tone
- Acknowledge good work

### Common Issues to Look For

#### Code Smells
- Long methods (>50 lines)
- Large classes (>300 lines)
- Deep nesting (>4 levels)
- Too many parameters (>5)
- Magic numbers/strings

#### Security Issues
- Hardcoded credentials
- SQL injection
- XSS vulnerabilities
- Missing authentication
- Improper error handling

#### Performance Issues
- Inefficient algorithms
- Missing indexes
- Excessive memory usage
- Blocking operations
- No caching

#### Testing Issues
- Missing tests
- Tests not asserting
- Flaky tests
- Test code duplication
- No integration tests

## Quick Reference

### Severity Levels
- **Critical**: Must fix before merge (security, data loss)
- **High**: Should fix before merge (performance, major bugs)
- **Medium**: Consider fixing (code quality, minor bugs)
- **Low**: Nice to have (style, documentation)

### Review Categories by Role
- **Developer**: Code quality, testing, documentation
- **Security Engineer**: Security, dependencies
- **Performance Engineer**: Performance, scalability
- **Tech Lead**: Architecture, decisions, standards

### Common Commands
```bash
# Run tests locally
npm test / go test / pytest / cargo test

# Check coverage
npm run coverage / go test -cover

# Run linter
npm run lint / golangci-lint run / ruff check

# Security scan
npm audit / gosec ./ / bandit -r .

# Build project
npm run build / go build / cargo build
```

## Review Templates

### Approval Template
```
✅ Approved
- Code looks good
- Tests are comprehensive
- No security issues found
- Performance is acceptable
- Documentation is updated
```

### Changes Requested Template
```
🔄 Changes Requested

Critical:
- 
- 

High:
- 
- 

Medium:
- 
- 

Please address these issues and I'll review again.
```

### Question Template
```
❓ Questions
- Can you explain why this approach was chosen?
- Have you considered [alternative]?
- What's the impact on performance?
```

## Review Metrics

### Quality Metrics
- Time to first review
- Review turnaround time
- Comments per PR
- Defect detection rate
- Review participation

### Target Metrics
- First review within 4 hours
- Complete review within 24 hours
- 80%+ bug detection rate
- 2+ reviewers per PR

## Continuous Improvement

### Review Retrospective
- What went well?
- What could be improved?
- Process changes needed?
- Training required?

### Best Practices
- Keep PRs small (<500 lines)
- Provide clear descriptions
- Respond to feedback promptly
- Learn from feedback
- Share knowledge

## Resources

### Documentation
- [Code Style Guide](../STYLE_GUIDE.md)
- [Security Guidelines](../SECURITY.md)
- [Testing Guide](../TESTING.md)
- [Performance Guidelines](../PERFORMANCE.md)

### Tools
- [SonarQube](https://sonarqube.sdlc.ai)
- [Security Scanner](https://security.sdlc.ai)
- [Performance Dashboard](https://performance.sdlc.ai)
- [Documentation](https://docs.sdlc.ai)

---

Remember: Code review is about improving the codebase and helping each other grow as developers. Be constructive, be kind, and focus on the code, not the person.