---
name: ll-review
displayName: Luna Code Review
description: Perform comprehensive code review of implemented features
version: 1.0.0
category: quality
agent: luna-code-review
parameters:
  - name: scope
    type: string
    description: Project or feature scope for review
    required: true
    prompt: true
workflow:
  - review_completed_tasks
  - check_code_quality_security
  - validate_against_requirements
  - identify_issues_improvements
  - generate_code_review_report
output:
  - .luna/{current-project}/code-review-report.md (project-level)
  - .luna/{current-project}/{feature}/code-review-report.md (feature-level)
prerequisites:
  - .luna/{current-project}/implementation-plan.md (with completed tasks)
  - .luna/{current-project}/design.md
  - .luna/{current-project}/requirements.md
  - implemented_source_code
---

# Luna Code Review

Performs comprehensive code review of all implemented features, checking quality, security, and compliance with requirements.

## What This Command Does

This command reviews all completed tasks in your implementation plan, performs code quality and security analysis, validates against requirements, and generates a detailed code review report with recommendations.

## Prerequisites

Requires in your current project:
- `.luna/{current-project}/implementation-plan.md` (with completed tasks showing [x])
- `.luna/{current-project}/design.md`
- `.luna/{current-project}/requirements.md`
- Implemented source code

If tasks aren't complete yet, run:
```bash
/luna-execute  # Repeat until all tasks are [x]
```

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for project-level review
- Type **feature-name** to match your implementation scope

## Execution Steps

1. **Task Review**: Reviews all completed tasks in your implementation plan
2. **Quality Analysis**: Checks code quality, maintainability, and best practices
3. **Security Assessment**: Performs security analysis and vulnerability scanning
4. **Requirements Validation**: Validates implementation against original requirements
5. **Issue Identification**: Identifies issues and improvement opportunities
6. **Report Generation**: Generates comprehensive code-review-report.md

## Output Files

Creates in your current project:
- `.luna/{current-project}/code-review-report.md` for project-level review
- `.luna/{current-project}/{feature}/code-review-report.md` for feature-level review

The review report includes:
- Critical, Major, and Minor issues found
- Security analysis and vulnerabilities
- Performance review and optimization opportunities
- Code quality assessment
- Recommendations with code examples
- Approval status and go/no-go decision

## Next Steps in Workflow

After addressing any critical issues identified in the review, run tests:
```
/luna-test
```

## Tips

- Address critical issues before proceeding to testing
- Review the recommendations for improving code quality
- Use the provided code examples to fix identified issues
- This review helps ensure production readiness