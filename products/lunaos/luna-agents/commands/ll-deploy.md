---
name: ll-deploy
displayName: Luna Deployment
description: Deploy application to staging and production environments
version: 1.0.0
category: deployment
agent: luna-deployment
parameters:
  - name: scope
    type: string
    description: Project or feature scope for deployment
    required: true
    prompt: true
workflow:
  - verify_deployment_readiness
  - configure_infrastructure
  - deploy_to_staging
  - run_smoke_tests
  - deploy_to_production
  - generate_deployment_report
output:
  - .luna/{current-project}/deployment-report.md (project-level)
  - .luna/{current-project}/{feature}/deployment-report.md (feature-level)
prerequisites:
  - .luna/{current-project}/implementation-plan.md
  - .luna/{current-project}/code-review-report.md
  - .luna/{current-project}/test-validation-report.md
  - .luna/{current-project}/design.md
  - all_tests_passing
---

# Luna Deployment

Deploys your application to staging and production environments with comprehensive validation and reporting.

## What This Command Does

This command verifies deployment readiness, configures infrastructure, deploys to staging, runs smoke tests, deploys to production, and generates a detailed deployment report with all necessary information.

## Prerequisites

Requires in your current project:
- `.luna/{current-project}/implementation-plan.md`
- `.luna/{current-project}/code-review-report.md`
- `.luna/{current-project}/test-validation-report.md`
- `.luna/{current-project}/design.md`
- All tests passing (from test validation report)

If you're missing any prerequisites, complete the workflow:
```bash
/luna-requirements
/luna-design
/luna-plan
/luna-execute  # Until all tasks complete
/luna-review
/luna-test
```

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for project-level deployment
- Type **feature-name** to match your implementation scope

## Execution Steps

1. **Readiness Verification**: Verifies all prerequisites and deployment readiness
2. **Infrastructure Configuration**: Sets up and configures deployment infrastructure
3. **Staging Deployment**: Deploys application to staging environment
4. **Smoke Testing**: Runs smoke tests to validate staging deployment
5. **Production Deployment**: Deploys application to production environment
6. **Report Generation**: Generates comprehensive deployment-report.md

## Output Files

Creates in your current project:
- `.luna/{current-project}/deployment-report.md` for project-level deployment
- `.luna/{current-project}/{feature}/deployment-report.md` for feature-level deployment

The deployment report includes:
- Deployment timeline with key milestones
- Environment configuration details
- Health check results for all deployed services
- Performance validation metrics
- Rollback plan and procedures
- Access credentials and endpoints
- Post-deployment verification results

## Next Steps in Workflow

After successful deployment, create documentation:
```
/luna-docs
```

## Tips

- Ensure all tests pass before attempting deployment
- Review the staging deployment results before production deployment
- Keep the deployment report for future reference and audits
- The rollback plan in the report helps you quickly recover from issues