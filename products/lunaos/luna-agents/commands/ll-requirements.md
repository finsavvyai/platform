---
name: ll-requirements
displayName: Luna Requirements Analysis
description: Analyze the project codebase and generate comprehensive requirements document
version: 1.0.0
category: analysis
agent: luna-requirements-analyzer
parameters:
  - name: scope
    type: string
    description: Project or feature scope to analyze
    required: true
    prompt: true
workflow:
  - prompt_for_scope
  - scan_project_structure
  - identify_gaps_missing_functionality
  - generate_requirements_document
output:
  - .luna/{current-project}/requirements.md (project-level)
  - .luna/{current-project}/{feature}/requirements.md (feature-level)
prerequisites: []
---

# Luna Requirements Analysis

Analyzes your project codebase and generates comprehensive requirements with acceptance criteria.

## What This Command Does

This command performs a thorough analysis of your project to identify gaps, missing functionality, and generate a complete requirements document with clear acceptance criteria.

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for entire project analysis
- Type a **feature-name** for specific feature analysis (e.g., "user-authentication")

## Execution Steps

1. **Scope Definition**: Prompts for project or feature scope to analyze
2. **Codebase Analysis**: Scans project structure and existing codebase
3. **Gap Analysis**: Identifies missing functionality and requirements gaps
4. **Requirements Generation**: Creates comprehensive requirements.md with acceptance criteria

## Output Files

Creates in your current project:
- `.luna/{current-project}/requirements.md` for project-level analysis
- `.luna/{current-project}/{feature}/requirements.md` for feature-level analysis

The requirements document includes:
- Functional requirements with acceptance criteria
- Non-functional requirements
- User stories and use cases
- Technical constraints and dependencies

## Next Steps in Workflow

After requirements are generated, proceed with:
```
/luna-design
```

This will transform your requirements into a comprehensive technical design specification.

## Tips

- Run this command at the start of new projects or major features
- Be specific with feature names for targeted analysis
- Review generated requirements before proceeding to design phase