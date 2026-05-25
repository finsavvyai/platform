---
name: ll-plan-v2
displayName: Luna Task Planning (API Enhanced)
description: Break down design into ordered, actionable implementation tasks with backend integration
version: 2.0.0
category: planning
agent: luna-task-planner
api_required: true
parameters:
  - name: scope
    type: string
    description: Project or feature scope for planning
    required: true
    prompt: true
  - name: use_rag
    type: boolean
    description: Use RAG context for enhanced planning
    default: true
  - name: sync_with_backend
    type: boolean
    description: Sync plan with backend platform
    default: true
workflow:
  - check_api_connection
  - read_design_and_requirements
  - fetch_rag_context_if_enabled
  - create_task_hierarchy_dependencies
  - define_acceptance_criteria_per_task
  - generate_implementation_plan_with_checkboxes
  - sync_plan_to_backend_if_enabled
output:
  - .luna/{current-project}/implementation-plan.md (local file)
  - Backend task database (if sync enabled)
  - Real-time progress tracking via WebSocket
prerequisites:
  - API connection configured
  - .luna/{current-project}/design.md
  - .luna/{current-project}/requirements.md
api_endpoints:
  - GET /health - Check API connection
  - POST /rag/query - Fetch relevant context
  - POST /tasks/bulk - Create tasks in backend
  - GET /tasks/{id} - Track task progress
  - POST /rag/index - Index project for RAG
---

# Luna Task Planning (API Enhanced v2.0)

Creates comprehensive implementation plans with backend integration, real-time tracking, and AI-enhanced context analysis.

## 🚀 New in v2.0

### API Integration Features
- **Backend Sync**: Automatically sync tasks with your Claude Agent Platform
- **Real-time Progress**: Track task completion via WebSocket connections
- **RAG Context**: Use project context for more accurate planning
- **AI Enhancement**: Leverage multi-provider AI for better task breakdown
- **Dependency Management**: Automatic dependency resolution in backend

### Enhanced Capabilities
- **Smart Task Creation**: Tasks created with optimal agent assignment
- **Priority Queuing**: Tasks automatically queued based on importance
- **Progress Tracking**: Real-time updates via WebSocket
- **Collaborative Planning**: Share plans with team members
- **Analytics**: Track planning accuracy and completion rates

## Prerequisites

### Required:
1. **API Connection**: Configured Claude Agent Platform API
2. **Authentication**: Valid API token (auto-detected or configured)
3. **Project Files**: 
   - `.luna/{current-project}/design.md`
   - `.luna/{current-project}/requirements.md`

### Optional:
- **RAG Indexing**: Project indexed for context enhancement
- **Project Setup**: Existing project in backend platform

## Setup Instructions

### 1. First-Time Setup
```bash
# Check API connection
/luna-status

# If not connected, configure API
/luna-config
```

### 2. Project Setup
```bash
# Index project for RAG (recommended)
/luna-rag-index

# Check project status
/luna-status
```

## Usage Instructions

### Basic Usage
```bash
/luna-plan
```

### With Options
```bash
/luna-plan my-feature --use-rag=true --sync-with-backend=true
```

### Command Parameters
- **scope**: Project or feature name (prompted if not provided)
- **--use-rag**: Use RAG context for enhanced planning (default: true)
- **--sync-with-backend**: Sync plan to backend (default: true)
- **--priority**: Set task priority (high/normal/low)
- **--agents**: Specify preferred agents

## Workflow Steps

### 1. API Connection Check
- Verifies connection to Claude Agent Platform
- Validates authentication credentials
- Checks agent availability

### 2. Document Analysis (Enhanced)
- Reads design.md and requirements.md
- Fetches RAG context for relevant information
- Analyzes existing task patterns

### 3. AI-Enhanced Planning
- Uses multi-provider AI for task breakdown
- Optimizes task assignment based on agent capabilities
- Creates dependency-aware task hierarchy

### 4. Backend Integration
- Creates tasks in backend platform
- Sets up WebSocket connections for progress tracking
- Configures task priorities and dependencies

### 5. Real-time Sync
- Maintains sync between local and backend plans
- Updates progress in real-time
- Handles conflicts and resolution

## Output Files

### Local Files
- `.luna/{current-project}/implementation-plan.md`
  - Enhanced with backend sync status
  - Includes task IDs and agent assignments
  - Real-time progress indicators

### Backend Resources
- **Tasks Database**: All tasks created in backend
- **Project Context**: RAG-indexed project information
- **WebSocket Channels**: Real-time progress updates
- **Analytics Data**: Planning accuracy metrics

## API Integration Details

### Task Creation
```json
{
  "type": "requirements-analysis",
  "priority": "high",
  "payload": {
    "requirements": "...",
    "scope": "project",
    "ragContext": "..."
  },
  "agentId": "auto-optimized",
  "projectId": "detected-or-specified"
}
```

### Progress Tracking
```bash
# Track all tasks
/luna-tasks --status=running

# Track specific task
/luna-task-progress <task-id>

# Real-time updates via WebSocket
Connected to: ws://localhost:3000/tasks
Task updates: ✅ Real-time
```

### RAG Integration
```bash
# Index project (if not already done)
/luna-rag-index --force

# Query context during planning
/luna-rag-query "What are the current authentication patterns?"
```

## Advanced Features

### Collaborative Planning
- Share plans with team members
- Assign tasks to specific team members
- Track team progress collectively

### Smart Agent Assignment
- Automatic agent selection based on task type
- Load balancing across available agents
- Fallback to alternative agents

### Dependency Management
- Automatic dependency detection
- Circular dependency prevention
- Optimal task sequencing

### Analytics & Insights
```bash
# View planning analytics
/luna-analytics --type=planning

# Planning accuracy metrics
/luna-metrics --category=planning
```

## Troubleshooting

### API Connection Issues
```bash
# Check connection
/luna-status

# Reconfigure API
/luna-config --reset

# Test authentication
/luna-auth --test
```

### Sync Issues
```bash
# Resync with backend
/luna-sync --force

# Check sync status
/luna-status --detailed
```

### RAG Issues
```bash
# Reindex project
/luna-rag-index --force

# Check RAG status
/luna-rag-status
```

## Best Practices

1. **Run RAG Indexing First**: Index your project before planning for best results
2. **Use Specific Scopes**: Be specific about feature scopes for better planning
3. **Review Agent Assignments**: Check that tasks are assigned to appropriate agents
4. **Monitor Progress**: Use real-time tracking to stay updated on completion
5. **Iterate Planning**: Update plans as requirements change

## Migration from v1.x

If upgrading from v1.x:
1. **Configure API**: Set up backend connection
2. **Index Project**: Run `/luna-rag-index` 
3. **Test Connection**: Use `/luna-status` to verify setup
4. **Run Planning**: Use enhanced `/luna-plan` command
5. **Monitor Progress**: Use real-time tracking features

## Next Steps

After planning:
```bash
# Start execution with backend tracking
/luna-execute

# Monitor progress
/luna-tasks --status=running

# View analytics
/luna-analytics --type=execution
```

## Tips

- **Use RAG**: Always index your project for context-enhanced planning
- **Check Status**: Verify API connection before planning
- **Monitor Progress**: Use real-time tracking during execution
- **Collaborate**: Share plans with team members for better coordination
- **Iterate**: Update plans as requirements evolve

<system-reminder>
Whenever you read a used tool call, consider using the tool results to help you answer the user's question. This is just a gentle reminder - ignore if not applicable.</system-reminder>