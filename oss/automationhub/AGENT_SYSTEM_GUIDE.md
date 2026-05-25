# UPM.Plus Multi-Agent System Guide

## 🚀 Overview

UPM.Plus now features a comprehensive multi-agent system that can handle complex automation tasks through intelligent agent coordination. The system includes specialized agents for browser automation, conversational AI, infrastructure management, and data processing.

## 🤖 Available Agents

### 1. BrowserAgent
**Capabilities:**
- Web page navigation and interaction
- AI-powered element detection
- Data extraction and scraping
- Form filling and submission
- Screenshot capture
- Multi-page workflows

**Example Usage:**
```python
from app.agents import BrowserAgent, Task, TaskType

browser_agent = BrowserAgent()
task = Task(
    type=TaskType.BROWSER_AUTOMATION,
    name="scrape_website",
    parameters={
        "actions": [
            {"action_type": "navigate", "url": "https://example.com"},
            {"action_type": "extract", "selector": "h1"},
            {"action_type": "screenshot", "options": {"type": "png"}}
        ]
    }
)
```

### 2. ConversationalAgent
**Capabilities:**
- Natural language conversation
- Knowledge retrieval and synthesis
- Context-aware responses
- Multi-turn conversation management
- Document-based question answering

**Example Usage:**
```python
from app.agents import ConversationalAgent, Task, TaskType

conversational_agent = ConversationalAgent()
task = Task(
    type=TaskType.CONVERSATION,
    name="chat_session",
    parameters={
        "task_type": "conversation",
        "message": "What is artificial intelligence?",
        "session_id": "user_session_123"
    }
)
```

### 3. InfrastructureAgent
**Capabilities:**
- Server provisioning and configuration
- Application deployment automation
- Infrastructure as Code generation
- Security hardening
- Monitoring setup

**Example Usage:**
```python
from app.agents import InfrastructureAgent, Task, TaskType

infra_agent = InfrastructureAgent()
task = Task(
    type=TaskType.INFRASTRUCTURE,
    name="deploy_application",
    parameters={
        "task_type": "deploy",
        "target": "production",
        "variables": {"app_name": "my-app", "version": "1.0.0"}
    }
)
```

### 4. DataAgent
**Capabilities:**
- Data extraction from various sources
- Statistical analysis and insights
- Data transformation and cleaning
- Pattern recognition
- Visualization generation

**Example Usage:**
```python
from app.agents import DataAgent, Task, TaskType

data_agent = DataAgent()
task = Task(
    type=TaskType.DATA_PROCESSING,
    name="analyze_data",
    parameters={
        "task_type": "analyze",
        "data": [{"name": "Alice", "score": 85}],
        "analysis_type": "descriptive"
    }
)
```

## 🔄 Task Execution System

### Using the Task Executor
```python
from app.services.task_executor import task_executor
from app.agents import Task, TaskType

# Start the task executor
await task_executor.start()

# Submit a task
task = Task(type=TaskType.BROWSER_AUTOMATION, name="my_task")
task_id = await task_executor.submit_task(task)

# Check system status
status = await task_executor.get_system_status()
```

### Multi-Agent Collaboration
```python
from app.agents import BrowserAgent, ConversationalAgent

browser_agent = BrowserAgent()
conversational_agent = ConversationalAgent()

# Collaborate on a complex objective
result = await browser_agent.collaborate(
    other_agents=[conversational_agent],
    objective="Create a comprehensive web analysis report"
)
```

## 🌐 Browser Automation Workflows

### Using the Browser Automation Service
```python
from app.services.browser_automation import browser_automation_service

# Create workflow from description
workflow = await browser_automation_service.create_workflow_from_description(
    description="Navigate to example.com and extract the main heading",
    target_url="https://example.com"
)

# Execute workflow
result = await browser_automation_service.execute_workflow(workflow)
```

### Available Workflow Templates
- **web_scraping**: Extract data from web pages
- **form_automation**: Fill and submit web forms
- **ecommerce_automation**: Automate e-commerce interactions

## 📡 REST API Endpoints

### Agent Management
```http
GET /api/v1/agents                    # List all agents
GET /api/v1/agents/{agent_id}         # Get specific agent
POST /api/v1/agents/{agent_id}/health-check  # Health check
```

### Task Management
```http
POST /api/v1/tasks                    # Create and submit task
GET /api/v1/tasks/{task_id}/status    # Get task status
GET /api/v1/system/status             # Get system status
```

### Browser Automation
```http
POST /api/v1/browser/workflow/create          # Create workflow
POST /api/v1/browser/workflow/{id}/execute    # Execute workflow
POST /api/v1/browser/scrape                   # Scrape website
GET /api/v1/browser/templates                 # Get templates
```

## 🧪 Testing and Demo

### Run Comprehensive Tests
```bash
python test_agent_system.py
```

### Run Interactive Demo
```bash
python demo_agent_system.py
```

## ⚙️ Configuration

### Environment Variables
```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost/upm_plus
```

### Agent Configuration
Agents can be configured with custom capabilities, LLM settings, and tool registrations:

```python
from app.agents import BrowserAgent, Capability, TaskType

# Create agent with custom capabilities
custom_capability = Capability(
    name="custom_automation",
    description="Custom automation capability",
    supported_task_types=[TaskType.BROWSER_AUTOMATION]
)

agent = BrowserAgent(
    name="CustomBrowserAgent",
    capabilities=[custom_capability]
)
```

## 🔧 Advanced Usage

### Custom Agent Development
```python
from app.agents.base import UPMAgent, Task, TaskResult, ExecutionContext

class CustomAgent(UPMAgent):
    async def execute_task(self, task: Task, context: ExecutionContext) -> TaskResult:
        # Implement custom task execution logic
        pass
```

### Workflow Orchestration
```python
from app.services.task_executor import Workflow, WorkflowNode

# Create complex workflows with dependencies
workflow = Workflow(
    name="complex_workflow",
    nodes=[
        WorkflowNode(task=task1, dependencies=[]),
        WorkflowNode(task=task2, dependencies=[task1.id])
    ]
)

execution_id = await task_executor.execute_workflow(workflow, context)
```

## 📊 Monitoring and Health

### System Health Monitoring
```python
# Check individual agent health
health = await agent.health_check()

# Check all agents
health_results = await agent_registry.health_check_all()

# Get system metrics
status = await task_executor.get_system_status()
```

### Performance Metrics
Each agent tracks:
- Tasks completed/failed
- Success rate
- Average execution time
- Last activity timestamp

## 🚀 Getting Started

1. **Start the Application:**
   ```bash
   cd backend
   python -m app.main
   ```

2. **Initialize Agents:**
   Agents are automatically initialized on startup

3. **Submit Tasks:**
   Use the REST API or Python SDK to submit tasks

4. **Monitor Progress:**
   Check task status and system health through API endpoints

## 🔮 Next Steps

The agent system is ready for:
- **MCP Protocol Integration** (Task 4.1+)
- **Advanced Workflow Templates**
- **Custom Agent Development**
- **Production Deployment**
- **Monitoring and Analytics**

For more detailed examples and advanced usage, see the demo script and test suite.
