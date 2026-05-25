# Studio Workflow Builder

LunaOS Studio is a visual workflow builder for creating and executing multi-agent pipelines.

**URL:** [studio.lunaos.ai](https://studio.lunaos.ai)

## Overview

Studio provides a drag-and-drop interface for composing agent workflows without writing code. Connect agents together to create powerful automation pipelines.

## Getting Started

1. Open [studio.lunaos.ai](https://studio.lunaos.ai)
2. Drag agent nodes from the palette onto the canvas
3. Connect nodes by dragging from output to input ports
4. Configure each node's settings in the config panel
5. Click **Run** to execute the workflow

## Node Types

### Agent Node
Executes a LunaOS agent (code-review, security-audit, etc.).

- **Input:** Context text from previous node or user input
- **Output:** Agent's analysis/response
- **Config:** Agent selection, provider, model, temperature

### Trigger Node
Starts a workflow based on an event.

- **Types:** Manual, Webhook, Schedule (cron), GitHub Push
- **Config:** Trigger conditions and filters

### Condition Node
Routes execution based on conditions.

- **Input:** Previous node's output
- **Output:** True/False branches
- **Config:** Match expression (contains, regex, score threshold)

### Output Node
Saves or sends the final result.

- **Types:** File, Email, Webhook, Dashboard notification
- **Config:** Destination and format

## Templates

### Full Code Review
```
Trigger → Code Review → Security Audit → Performance Review → Documentation Check → Output
```

### New Feature Pipeline
```
Trigger → Requirements → Design Architect → Task Planner → Code Review → Output
```

### Deploy Check
```
Trigger → Testing → Security Audit → Deployment Agent → Output
```

### Security Scan
```
Trigger → Code Review → Security Audit → 365 Security → Output
```

### API Design
```
Trigger → Requirements → API Generator → Documentation → Output
```

## Pipeline JSON Format

Workflows export as `pipeline.json`:

```json
{
  "name": "My Workflow",
  "version": "1.0",
  "nodes": [
    {
      "id": "node-1",
      "type": "trigger",
      "position": { "x": 100, "y": 200 },
      "data": { "triggerType": "manual" }
    },
    {
      "id": "node-2",
      "type": "agent",
      "position": { "x": 400, "y": 200 },
      "data": { "agent": "code-review", "provider": "anthropic" }
    }
  ],
  "edges": [
    { "source": "node-1", "target": "node-2" }
  ]
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd+S` | Save workflow |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Delete` | Remove selected node |
| `Cmd+E` | Export pipeline.json |
| `Cmd+Enter` | Run workflow |
| `Space` | Toggle minimap |
