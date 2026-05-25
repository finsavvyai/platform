---
name: ll-test
displayName: Luna Testing & Validation
description: Create comprehensive test suites and validate against requirements
version: 1.0.0
category: testing
agent: luna-testing-validation
parameters:
  - name: scope
    type: string
    description: Project or feature scope for testing
    required: true
    prompt: true
workflow:
  - create_missing_test_cases
  - run_all_test_suites
  - validate_acceptance_criteria
  - check_code_coverage
  - generate_test_validation_report
output:
  - .luna/{current-project}/test-validation-report.md (project-level)
  - .luna/{current-project}/{feature}/test-validation-report.md (feature-level)
prerequisites:
  - .luna/{current-project}/requirements.md
  - .luna/{current-project}/design.md
  - .luna/{current-project}/implementation-plan.md
  - .luna/{current-project}/code-review-report.md
  - implemented_source_code
---

# Luna Testing & Validation

Creates comprehensive test suites and validates implementation against requirements with detailed reporting.

## What This Command Does

This command creates missing test cases, runs all test suites (unit, integration, E2E), validates acceptance criteria, checks code coverage, and generates a comprehensive test validation report.

## Prerequisites

Requires in your current project:
- `.luna/{current-project}/requirements.md`
- `.luna/{current-project}/design.md`
- `.luna/{current-project}/implementation-plan.md`
- `.luna/{current-project}/code-review-report.md`
- Implemented source code

If you're missing any prerequisites, run the workflow commands in order:
```bash
/luna-requirements
/luna-design
/luna-plan
/luna-execute  # Until all tasks complete
/luna-review
```

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for project-level testing
- Type **feature-name** to match your implementation scope

## Execution Steps

1. **Test Creation**: Creates missing test cases for your project
2. **Test Execution**: Runs all test suites (unit, integration, E2E)
3. **Requirements Validation**: Validates implementation against acceptance criteria
4. **Coverage Analysis**: Checks code coverage and identifies gaps
5. **Report Generation**: Generates comprehensive test-validation-report.md

## Output Files

Creates in your current project:
- `.luna/{current-project}/test-validation-report.md` for project-level testing
- `.luna/{current-project}/{feature}/test-validation-report.md` for feature-level testing

The test report includes:
- Test coverage summary with percentages
- Requirements validation matrix showing which criteria are met
- Failed/passed tests breakdown with detailed results
- Performance test results and benchmarks
- Security scan results and vulnerability assessment
- Go/No-Go recommendation for deployment

## Next Steps in Workflow

After all tests pass and you have a "Go" recommendation, deploy:
```
/luna-deploy
```

## Tips

- Address any test failures before proceeding to deployment
- Aim for high code coverage (>80% for most projects)
- Review performance test results to ensure scalability
- This validation ensures your implementation meets all requirements and quality standards