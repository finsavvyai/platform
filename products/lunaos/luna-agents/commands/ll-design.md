---
name: ll-design
displayName: Luna Design Architecture
description: Transform requirements into comprehensive technical design specification
version: 1.0.0
category: design
agent: luna-design-architect
parameters:
  - name: scope
    type: string
    description: Project or feature scope for design
    required: true
    prompt: true
workflow:
  - read_requirements_document
  - design_system_architecture
  - create_component_specifications
  - define_data_models_api_endpoints
  - generate_design_document
output:
  - .luna/{current-project}/design.md (project-level)
  - .luna/{current-project}/{feature}/design.md (feature-level)
prerequisites:
  - .luna/{current-project}/requirements.md
---

# Luna Design Architecture

Transforms your requirements into comprehensive technical design specifications with implementation guidelines.

## What This Command Does

This command reads your requirements document and creates a detailed technical design including system architecture, component specifications, data models, API endpoints, and implementation guidelines.

## Prerequisites

Requires in your current project:
- `.luna/{current-project}/requirements.md`

If you don't have requirements yet, run:
```
/luna-requirements
```

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for project-level design
- Type **feature-name** to match your requirements scope

## Execution Steps

1. **Requirements Analysis**: Reads and analyzes the requirements.md from your project
2. **Architecture Design**: Designs comprehensive system architecture
3. **Component Specification**: Creates detailed component specifications
4. **Data Modeling**: Defines data models and API endpoints
5. **Design Generation**: Generates design.md with implementation guidelines

## Output Files

Creates in your current project:
- `.luna/{current-project}/design.md` for project-level design
- `.luna/{current-project}/{feature}/design.md` for feature-level design

The design document includes:
- System architecture diagrams
- Component specifications and responsibilities
- Data models and relationships
- API endpoint specifications
- Technology stack recommendations
- Implementation guidelines and best practices

## Next Steps in Workflow

After design is complete, proceed with:
```
/luna-plan
```

This will break down your design into ordered, actionable implementation tasks.

## Tips

- Ensure your requirements document is complete before running this command
- Review the generated architecture for scalability and maintainability
- Consider your team's technical expertise when reviewing technology choices