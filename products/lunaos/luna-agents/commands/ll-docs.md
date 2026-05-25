---
name: ll-docs
displayName: Luna Documentation
description: Create comprehensive user, developer, and API documentation
version: 1.0.0
category: documentation
agent: luna-documentation
parameters:
  - name: scope
    type: string
    description: Project or feature scope for documentation
    required: true
    prompt: true
workflow:
  - generate_user_guides
  - create_developer_documentation
  - document_api_endpoints
  - write_deployment_guides
  - create_operations_runbooks
output:
  - docs/user-guide/ (end-user documentation)
  - docs/developers/ (developer documentation)
  - docs/api/ (API reference)
  - docs/operations/ (DevOps documentation)
prerequisites:
  - .luna/{current-project}/requirements.md
  - .luna/{current-project}/design.md
  - .luna/{current-project}/implementation-plan.md
  - .luna/{current-project}/deployment-report.md
  - source_code
---

# Luna Documentation

Creates comprehensive documentation covering user guides, developer documentation, API references, and operational runbooks.

## What This Command Does

This command generates complete documentation for your project including user guides, developer documentation, API endpoint documentation, deployment guides, and operations runbooks based on your Luna specifications.

## Prerequisites

Requires in your current project:
- `.luna/{current-project}/requirements.md`
- `.luna/{current-project}/design.md`
- `.luna/{current-project}/implementation-plan.md`
- `.luna/{current-project}/deployment-report.md`
- Source code

If you're missing any prerequisites, complete the workflow:
```bash
/luna-requirements
/luna-design
/luna-plan
/luna-execute  # Until all tasks complete
/luna-review
/luna-test
/luna-deploy
```

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for project-level documentation
- Type **feature-name** for feature-specific documentation

## Execution Steps

1. **User Guide Generation**: Creates comprehensive end-user documentation
2. **Developer Documentation**: Generates detailed developer documentation
3. **API Documentation**: Documents all API endpoints with examples
4. **Deployment Guides**: Writes step-by-step deployment instructions
5. **Operations Runbooks**: Creates operational procedures and troubleshooting guides

## Output Files

Creates comprehensive documentation in your project's `docs/` directory:
- `docs/user-guide/` - End-user documentation with tutorials and guides
- `docs/developers/` - Developer documentation with setup and contribution guides
- `docs/api/` - Complete API reference with examples and schemas
- `docs/operations/` - DevOps documentation with deployment and monitoring procedures

The documentation references your Luna specifications from `.luna/{current-project}/` files to ensure consistency and completeness.

## Documentation Contents

**User Guide:**
- Getting started tutorials
- Feature walkthroughs
- Common use cases and examples
- Troubleshooting for end users

**Developer Documentation:**
- Development environment setup
- Architecture overview
- Contributing guidelines
- Code style and standards

**API Documentation:**
- Complete endpoint reference
- Request/response examples
- Authentication and authorization
- Error handling and status codes

**Operations Documentation:**
- Deployment procedures
- Monitoring and alerting
- Backup and recovery
- Security configurations

## Next Steps in Workflow

Set up monitoring for your deployed application:
```
/luna-monitor
```

## Tips

- Review generated documentation for accuracy and completeness
- Customize examples to match your specific use cases
- Keep documentation updated as your project evolves
- Good documentation improves user adoption and developer productivity