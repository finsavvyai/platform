---
name: ll-execute
displayName: Luna Task Execution
description: Implement tasks from the implementation plan in order
version: 1.0.0
category: implementation
agent: luna-task-executor
parameters:
  - name: scope
    type: string
    description: Project or feature scope for execution
    required: true
    prompt: true
workflow:
  - find_next_uncompleted_task
  - implement_code_following_design_specs
  - write_tests_for_new_functionality
  - mark_task_complete
  - update_implementation_plan
output:
  - modified_source_code_files
  - updated_implementation-plan.md_with_x_marks
  - git_commits_for_completed_tasks
prerequisites:
  - .luna/{current-project}/implementation-plan.md
  - .luna/{current-project}/design.md
  - .luna/{current-project}/requirements.md
---

# Luna Task Execution

Implements tasks from your implementation plan in the correct order, one task at a time.

## What This Command Does

This command finds the next uncompleted task in your implementation plan, implements the code following your design specifications, writes tests, and marks the task as complete.

## Prerequisites

Requires in your current project:
- `.luna/{current-project}/implementation-plan.md`
- `.luna/{current-project}/design.md`
- `.luna/{current-project}/requirements.md`

If you don't have these files, run the workflow commands in order:
```
/luna-requirements
/luna-design
/luna-plan
```

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for project-level execution
- Type **feature-name** to match your plan scope

## Execution Steps

1. **Task Selection**: Finds the next uncompleted task [ ] in your implementation plan
2. **Code Implementation**: Implements code following design specifications
3. **Test Creation**: Writes tests for the new functionality
4. **Task Completion**: Marks the task as complete [x]
5. **Plan Update**: Updates the implementation-plan.md file

## Running Multiple Times

Each execution completes **ONE task only**. Run repeatedly to complete all tasks:

```bash
/luna-execute  # Completes task 1.1
/luna-execute  # Completes task 1.2
/luna-execute  # Completes task 1.3
# Continue until all [ ] become [x]
```

## Output

In your current project:
- Modified source code files implementing the task
- Updated implementation-plan.md with [x] marks for completed tasks
- Git commits for each completed task
- Test files for new functionality

## Next Steps in Workflow

After all tasks are complete, run code review:
```
/luna-review
```

## Tips

- Run this command repeatedly until all tasks show [x] instead of [ ]
- Each task builds on previous ones, so don't skip ahead
- The command automatically handles task dependencies
- Check your implementation-plan.md to see progress
- Each completed task is committed to git for easy rollback