# Code Review Checklist

## 📋 Overview
This checklist ensures consistent, high-quality code reviews across the SDLC.ai platform.

## 🔍 Pre-Review Checks (For Reviewer)
Before starting the review:
- [ ] I understand the purpose of this PR
- [ ] I have read the description and testing instructions
- [ ] I have run the automated tests locally
- [ ] I have reviewed the automated check results
- [ ] I am qualified to review these changes

## 📝 Code Quality Review

### Structure and Design
- [ ] Code follows project architecture
- [ ] Functions/classes have single responsibility
- [ ] Appropriate design patterns used
- [ ] No code duplication
- [ ] Abstractions are sensible
- [ ] Dependencies are minimal

### Implementation
- [ ] Code is readable and self-documenting
- [ ] Variable/function names are descriptive
- [ ] Comments explain why, not what
- [ ] Complex logic is documented
- [ ] No magic numbers or strings
- [ ] Constants used where appropriate

### Error Handling
- [ ] Errors are handled appropriately
- [ ] Error messages are helpful
- [ ] No silent failures
- [ ] Exceptions are specific
- [ ] Logging is included for debugging
- [ ] Resource cleanup implemented

### Performance
- [ ] Algorithm is efficient
- [ ] No unnecessary computations
- [ ] Database queries are optimized
- [ ] Caching used where appropriate
- [ ] Memory usage is reasonable
- [ ] No memory leaks

### Testing
- [ ] Tests cover happy path
- [ ] Tests cover edge cases
- [ ] Tests cover error conditions
- [ ] Test names are descriptive
- [ ] Tests are independent
- [ ] Test data is well-organized

## 🔒 Security Review

### Authentication & Authorization
- [ ] Authentication is properly implemented
- [ ] Authorization checks are in place
- [ ] Privilege escalation is prevented
- [ ] Session management is secure
- [ ] Password policies are followed
- [ ] MFA is implemented where required

### Input Validation
- [ ] All inputs are validated
- [ ] Sanitization is implemented
- [ ] SQL injection is prevented
- [ ] XSS is prevented
- [ ] CSRF protection is in place
- [ ] File uploads are secured

### Data Protection
- [ ] Sensitive data is encrypted
- [ ] Secrets are not hardcoded
- [ ] PII is protected
- [ ] Data in transit is encrypted
- [ ] Data at rest is encrypted
- [ ] Data retention policies followed

### API Security
- [ ] Rate limiting is implemented
- [ ] API keys are secured
- [ ] CORS is properly configured
- [ ] Input/output is validated
- [ ] Error messages don't leak info
- [ ] API versioning is considered

## 🚀 Performance Review

### Response Time
- [ ] API response times are acceptable (<500ms p95)
- [ ] Database queries are optimized
- [ ] Indexes are used appropriately
- [ ] N+1 queries are avoided
- [ ] Caching strategies are implemented
- [ ] Async operations are used where applicable

### Scalability
- [ ] Code scales with load
- [ ] Resources are properly managed
- [ ] Connections are pooled
- [ ] Pagination is implemented
- [ ] Batching is used for bulk operations
- [ ] Throttling is implemented

### Resource Usage
- [ ] Memory usage is optimized
- [ ] CPU usage is reasonable
- [ ] Network calls are minimized
- [ ] File I/O is efficient
- [ ] Garbage collection is considered
- [ ] Resource cleanup is implemented

## 📚 Documentation Review

### Code Documentation
- [ ] Public interfaces are documented
- [ ] Complex algorithms are explained
- [ ] API endpoints are documented
- [ ] Configuration is documented
- [ ] Setup instructions are clear
- [ ] Examples are provided

### Commit/PR Documentation
- [ ] Commit messages are clear
- [ ] PR description is comprehensive
- [ ] Changes are explained
- [ ] Breaking changes are highlighted
- [ ] Migration guide is provided
- [ ] Testing instructions are included

## 🔧 Tooling and Standards Review

### Code Style
- [ ] Code follows style guide
- [ ] Linting rules are followed
- [ ] Formatting is consistent
- [ ] Imports are organized
- [ ] File structure is correct
- [ ] Naming conventions are followed

### Dependencies
- [ ] Dependencies are necessary
- [ ] Dependency versions are appropriate
- [ ] Security vulnerabilities are checked
- [ ] License compatibility is verified
- [ ] Dependency updates are considered
- [ ] Vendor lock-in is avoided

### Build and Deployment
- [ ] Build configuration is correct
- [ ] Environment variables are used
- [ ] Configuration is externalized
- [ ] Health checks are implemented
- [ ] Logging is configured
- [ ] Monitoring is integrated

## 📋 Review Process

### Review Guidelines
1. **Be Constructive**: Provide helpful, actionable feedback
2. **Explain Why**: Explain the reasoning behind suggestions
3. **Suggest Solutions**: Don't just point out problems
4. **Acknowledge Good Work**: Recognize well-written code
5. **Ask Questions**: If unclear, ask for clarification
6. **Be Respectful**: Maintain professional tone

### Review Categories
1. **Must Fix**: Blocking issues that must be resolved
2. **Should Fix**: Important issues that should be resolved
3. **Consider**: Suggestions for improvement
4. **Nitpicks**: Minor style or formatting issues

### Review Template
```markdown
## Review Summary
Overall impression: [Excellent/Good/Needs Work]

## 🚨 Must Fix
- 

## ⚠️ Should Fix
- 

## 💡 Suggestions
- 

## 💬 Comments
- 

## ✅ Approval
[ ] Approved
[ ] Approved with suggestions
[ ] Request changes
```

## ✅ Approval Criteria

### Minimum Requirements for Approval
- [ ] All automated checks pass
- [ ] Code quality meets standards
- [ ] Security review passed (if required)
- [ ] Performance review passed (if critical)
- [ ] Documentation is adequate
- [ ] Tests are comprehensive

### Additional Requirements for Different Types

#### Feature Addition
- [ ] Feature meets requirements
- [ ] Edge cases are handled
- [ ] Performance impact is acceptable
- [ ] Documentation is complete
- [ ] Tests are thorough

#### Bug Fix
- [ ] Root cause is identified
- [ ] Fix is complete
- [ ] Regression tests added
- [ ] No side effects
- [ ] Fix is tested

#### Refactoring
- [ ] Code is cleaner
- [ ] Behavior is unchanged
- [ ] Tests still pass
- [ ] Performance is not degraded
- [ ] Documentation is updated

#### Security Change
- [ ] Security team review completed
- [ ] Security test plan executed
- [ ] Security requirements met
- [ ] Documentation updated
- [ ] Monitoring implemented

#### Performance Change
- [ ] Performance tests executed
- [ ] Benchmarks provided
- [ ] No regression
- [ ] Monitoring added
- [ ] Documentation updated

## 📊 Review Metrics

### Metrics to Track
- Review time
- Number of comments
- Approval rate
- Rework required
- Types of issues found

### Quality Indicators
- Number of review rounds
- Bug detection rate
- Code improvement suggestions
- Knowledge sharing

## 🔄 Post-Review Actions

### For Author
- [ ] Address all feedback
- [ ] Update tests as needed
- [ ] Update documentation
- [ ] Re-request reviews
- [ ] Respond to all comments

### For Reviewer
- [ ] Verify feedback addressed
- [ ] Re-run tests if needed
- [ ] Provide final approval
- [ ] Share knowledge with team
- [ ] Document learnings

## 🚨 Escalation Process

### When to Escalate
- Disagreement on technical decision
- Security concerns
- Performance requirements not met
- Architecture disagreements
- Timeline concerns

### Escalation Path
1. **Tech Lead**: For technical decisions
2. **Architect**: For architecture concerns
3. **Security Lead**: For security issues
4. **Engineering Manager**: For process issues
5. **CTO**: For strategic decisions

## 📚 Resources

### Documentation
- [Code Standards](../standards/)
- [Security Guidelines](../security/)
- [Performance Guidelines](../performance/)
- [Testing Guidelines](../testing/)

### Tools
- SonarQube: [Quality Dashboard](https://sonarqube.sdlc.ai)
- Snyk: [Security Dashboard](https://snyk.io)
- Grafana: [Performance Dashboard](https://grafana.sdlc.ai)

### Training
- Code Review Best Practices
- Secure Code Review
- Performance Review Techniques
- Communication Skills

---

Remember: The goal of code review is to improve code quality and share knowledge. Be thorough, be kind, and help your team succeed!