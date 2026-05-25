---
name: ll-plan
displayName: Luna Task Planning
description: Break down design into ordered, actionable implementation tasks
version: 1.0.0
category: planning
agent: luna-task-planner
parameters:
  - name: scope
    type: string
    description: Project or feature scope for planning
    required: true
    prompt: true
workflow:
  - read_design_and_requirements
  - create_task_hierarchy_dependencies
  - define_acceptance_criteria_per_task
  - generate_implementation_plan_with_checkboxes
output:
  - .luna/{current-project}/implementation-plan.md (project-level)
  - .luna/{current-project}/{feature}/implementation-plan.md (feature-level)
prerequisites:
  - .luna/{current-project}/design.md
  - .luna/{current-project}/requirements.md
---

# Luna Task Planning

Breaks down your design into ordered, actionable implementation tasks with clear dependencies and acceptance criteria.

## What This Command Does

This command reads your design and requirements documents, then creates a comprehensive implementation plan with ordered tasks, dependencies, and checkboxes to track progress.

## Prerequisites

Requires in your current project:
- `.luna/{current-project}/design.md`
- `.luna/{current-project}/requirements.md`

If you don't have these files, run:
```
/luna-requirements
/luna-design
```

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for project-level planning
- Type **feature-name** to match your design scope

## Execution Steps

1. **Document Analysis**: Reads design.md and requirements.md from your project
2. **Task Hierarchy**: Creates task hierarchy with clear dependencies
3. **Acceptance Criteria**: Defines acceptance criteria for each task
4. **Plan Generation**: Generates implementation-plan.md with checkboxes

## Output Files

Creates in your current project:
- `.luna/{current-project}/implementation-plan.md` for project-level planning
- `.luna/{current-project}/{feature}/implementation-plan.md` for feature-level planning

The implementation plan includes:
- Ordered tasks with [ ] checkboxes that become [x] when completed
- Task dependencies and relationships
- Acceptance criteria for each task
- Estimated effort and complexity indicators
- Clear sequencing for systematic implementation

## Next Steps in Workflow

Start implementing tasks:
```
/luna-execute
```

Run the execute command repeatedly to complete tasks one by one.

## Tips

- Review the task order before starting implementation
- Each task builds on previous ones - follow the sequence
- Tasks will be marked [x] automatically as completed during execution
- You can run `/luna-execute` multiple times to complete all tasks