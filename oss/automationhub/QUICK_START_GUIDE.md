# UPM.Plus Quick Start Guide
## Onboard Your Project in 15 Minutes

**Last Updated:** 2025-09-30  
**System Status:** ✅ Production Ready  
**Prerequisites:** Python 3.12+, Redis, PostgreSQL (optional)

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Environment Setup

```bash
# Clone and setup
cd /Users/shaharsolomon/dev/projects/github/upm.plus
python3.12 -m venv venv
source venv/bin/activate

# Install dependencies (core only for quick start)
pip install fastapi uvicorn sqlalchemy aiosqlite \
            openai playwright redis celery pandas \
            python-dotenv pydantic-settings

# Install Playwright browsers
playwright install chromium
```

### Step 2: Configure Environment

Create `.env` file:

```bash
# .env
# Core settings
DATABASE_URL=sqlite+aiosqlite:///./upm_plus.db
REDIS_URL=redis://localhost:6379/0

# AI Services (optional - system works without these)
OPENAI_API_KEY=your_key_here  # Get from https://platform.openai.com
ANTHROPIC_API_KEY=your_key_here  # Get from https://console.anthropic.com

# Optional: Vector DB (for RAG features)
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

### Step 3: Start Services

```bash
# Terminal 1: Start Redis (required for task queue)
redis-server

# Terminal 2: Start Celery worker (for async tasks)
cd backend
celery -A app.services.task_executor worker --loglevel=info

# Terminal 3: Start FastAPI server
cd backend
uvicorn app.main:app --reload --port 8000
```

### Step 4: Verify Installation

```bash
# Run tests to verify everything works
python3.12 test_agent_system.py

# Expected output:
# 🎉 ALL TESTS PASSED! (8/8)
```

---

## 📋 Choose Your Use Case

### Option A: Browser Automation (Most Popular)

**Use Case:** Automate web tasks, scraping, form filling, testing

```python
# example_browser_automation.py
import asyncio
from app.agents.browser_agent import BrowserAgent
from app.agents.base import Task, TaskType, ExecutionContext
from uuid import uuid4

async def automate_website():
    # Create browser agent
    agent = BrowserAgent()
    
    # Define task: Navigate and extract data
    task = Task(
        type=TaskType.BROWSER_AUTOMATION,
        name="extract_product_info",
        description="Get product title and price",
        parameters={
            "actions": [
                {
                    "action_type": "navigate",
                    "url": "https://example.com/product/123"
                },
                {
                    "action_type": "extract",
                    "selector": "h1.product-title",
                    "options": {}
                },
                {
                    "action_type": "extract",
                    "selector": ".price",
                    "options": {}
                },
                {
                    "action_type": "screenshot",
                    "options": {"type": "png", "full_page": True}
                }
            ]
        }
    )
    
    # Execute task
    context = ExecutionContext(session_id=uuid4())
    result = await agent.execute_task(task, context)
    
    print(f"Status: {result.status}")
    print(f"Result: {result.result}")
    
    # Cleanup
    await agent.cleanup()

# Run it
asyncio.run(automate_website())
```

**Run:**
```bash
python example_browser_automation.py
```

### Option B: AI-Powered Workflows

**Use Case:** Natural language automation, AI-generated workflows

```python
# example_ai_workflow.py
import asyncio
from app.services.browser_automation import browser_automation_service
from app.agents.base import ExecutionContext
from uuid import uuid4

async def ai_powered_automation():
    # Create workflow from natural language
    workflow = await browser_automation_service.create_workflow_from_description(
        description="Go to example.com, find the main heading, and take a screenshot",
        target_url="https://example.com"
    )
    
    print(f"Generated workflow with {len(workflow.actions)} actions")
    
    # Execute workflow
    context = ExecutionContext(session_id=uuid4())
    result = await browser_automation_service.execute_workflow(workflow, context)
    
    print(f"Success: {result.success}")
    print(f"Results: {result.results}")
    
    # Cleanup
    await browser_automation_service.cleanup()

asyncio.run(ai_powered_automation())
```

### Option C: Multi-Agent Collaboration

**Use Case:** Complex tasks requiring multiple agent types

```python
# example_multi_agent.py
import asyncio
from app.agents import BrowserAgent, ConversationalAgent
from app.agents.base import ExecutionContext
from uuid import uuid4

async def multi_agent_task():
    # Create agents
    browser_agent = BrowserAgent()
    ai_agent = ConversationalAgent()
    
    # Define collaboration objective
    objective = "Scrape competitor website and generate analysis report"
    context = ExecutionContext(session_id=uuid4())
    
    # Agents collaborate
    result = await browser_agent.collaborate(
        other_agents=[ai_agent],
        objective=objective,
        context=context
    )
    
    print(f"Collaboration success: {result.success}")
    print(f"Participating agents: {len(result.participating_agents)}")
    print(f"Result: {result.result}")
    
    # Cleanup
    await browser_agent.cleanup()

asyncio.run(multi_agent_task())
```

---

## 🔌 Integration Patterns

### Pattern 1: REST API Integration

**Start the API server:**
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Call from any language:**
```bash
# Submit browser automation task
curl -X POST http://localhost:8000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "browser_automation",
    "name": "scrape_page",
    "parameters": {
      "actions": [
        {"action_type": "navigate", "url": "https://example.com"},
        {"action_type": "extract", "selector": "h1"}
      ]
    }
  }'

# Check task status
curl http://localhost:8000/api/v1/tasks/{task_id}
```

### Pattern 2: Python SDK Integration

```python
# your_app.py
from app.agents import initialize_agents, agent_registry
from app.services.task_executor import task_executor
from app.agents.base import Task, TaskType, ExecutionContext

async def integrate_with_your_app():
    # Initialize UPM.Plus
    initialize_agents()
    await task_executor.start()
    
    # Use in your application
    task = Task(
        type=TaskType.BROWSER_AUTOMATION,
        name="your_custom_task",
        parameters={"actions": [...]}
    )
    
    task_id = await task_executor.submit_task(task)
    print(f"Task submitted: {task_id}")
```

### Pattern 3: Scheduled Automation

```python
# scheduled_tasks.py
from celery import Celery
from app.agents.browser_agent import BrowserAgent

app = Celery('tasks', broker='redis://localhost:6379/0')

@app.task
def daily_price_check():
    """Run every day at 9 AM"""
    agent = BrowserAgent()
    # Your automation logic here
    result = agent.execute_task(...)
    return result

# Schedule in celery beat
app.conf.beat_schedule = {
    'daily-price-check': {
        'task': 'scheduled_tasks.daily_price_check',
        'schedule': crontab(hour=9, minute=0),
    },
}
```

---

## 🎯 Real-World Examples

### Example 1: E-Commerce Price Monitoring

```python
# price_monitor.py
import asyncio
from app.services.browser_automation import browser_automation_service

async def monitor_competitor_prices():
    competitors = [
        "https://competitor1.com/product/123",
        "https://competitor2.com/product/456",
        "https://competitor3.com/product/789"
    ]
    
    results = []
    for url in competitors:
        # Scrape price
        data = await browser_automation_service.scrape_website(
            url=url,
            selectors=[".price", ".product-name", ".availability"]
        )
        results.append(data)
    
    # Analyze results
    for result in results:
        print(f"Product: {result['data'].get('selector_1')}")
        print(f"Price: {result['data'].get('selector_0')}")
        print(f"Available: {result['data'].get('selector_2')}")
        print("---")
    
    return results

# Run daily
if __name__ == "__main__":
    asyncio.run(monitor_competitor_prices())
```

### Example 2: Form Automation at Scale

```python
# bulk_form_submission.py
import asyncio
import pandas as pd
from app.services.browser_automation import browser_automation_service

async def submit_bulk_forms():
    # Load data from CSV
    df = pd.read_csv("contacts.csv")
    
    for _, row in df.iterrows():
        # Fill and submit form
        result = await browser_automation_service.fill_form(
            form_url="https://example.com/contact",
            form_data={
                "input[name='name']": row['name'],
                "input[name='email']": row['email'],
                "textarea[name='message']": row['message']
            },
            submit_selector="button[type='submit']"
        )
        
        print(f"Form submitted for {row['name']}: {result['success']}")
        
        # Respectful delay
        await asyncio.sleep(2)

asyncio.run(submit_bulk_forms())
```

### Example 3: AI Customer Support

```python
# ai_support.py
import asyncio
from app.agents.conversational_agent import ConversationalAgent
from app.agents.base import Task, TaskType, ExecutionContext
from uuid import uuid4

async def handle_customer_query(question: str):
    agent = ConversationalAgent()
    
    task = Task(
        type=TaskType.CONVERSATION,
        name="customer_support",
        description="Answer customer question",
        parameters={
            "task_type": "conversation",
            "message": question,
            "system_prompt": "You are a helpful customer support agent."
        }
    )
    
    context = ExecutionContext(session_id=uuid4())
    result = await agent.execute_task(task, context)
    
    return result.result['response']

# Example usage
async def main():
    questions = [
        "What are your business hours?",
        "How do I reset my password?",
        "What's your return policy?"
    ]
    
    for q in questions:
        answer = await handle_customer_query(q)
        print(f"Q: {q}")
        print(f"A: {answer}\n")

asyncio.run(main())
```

### Example 4: Infrastructure Deployment

```python
# deploy_infrastructure.py
import asyncio
from app.agents.infrastructure_agent import InfrastructureAgent
from app.agents.base import Task, TaskType, ExecutionContext
from uuid import uuid4

async def deploy_application():
    agent = InfrastructureAgent()
    
    task = Task(
        type=TaskType.INFRASTRUCTURE,
        name="deploy_web_app",
        description="Deploy web application to production",
        parameters={
            "task_type": "deploy",
            "target": "production_servers",
            "variables": {
                "app_name": "my_web_app",
                "version": "v2.1.0",
                "environment": "production",
                "replicas": 3
            }
        }
    )
    
    context = ExecutionContext(session_id=uuid4())
    result = await agent.execute_task(task, context)
    
    print(f"Deployment status: {result.status}")
    print(f"Playbook: {result.result.get('playbook_path')}")
    
    return result

asyncio.run(deploy_application())
```

---

## 📊 Monitoring & Debugging

### Check System Health

```python
# health_check.py
import asyncio
from app.services.task_executor import task_executor
from app.agents.registry import agent_registry

async def check_health():
    # Start system
    await task_executor.start()
    
    # Check executor status
    status = await task_executor.get_system_status()
    print(f"Task Executor: {status}")
    
    # Check agent health
    health = await agent_registry.health_check_all()
    print(f"Agent Health: {health}")
    
    # Registry stats
    stats = agent_registry.get_registry_stats()
    print(f"Registry Stats: {stats}")
    
    await task_executor.stop()

asyncio.run(check_health())
```

### Enable Debug Logging

```python
# debug_mode.py
import logging
import asyncio

# Enable detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Your code here
```

### View Task Execution History

```bash
# Query task results from database
python -c "
from app.core.database import get_db
import asyncio

async def view_tasks():
    async for db in get_db():
        # Query recent tasks
        result = await db.execute('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10')
        tasks = result.fetchall()
        for task in tasks:
            print(task)

asyncio.run(view_tasks())
"
```

---

## 🔐 Security & Production Setup

### Environment Variables (Production)

```bash
# .env.production
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/upm_plus
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=yourdomain.com,api.yourdomain.com
CORS_ORIGINS=https://yourdomain.com

# AI Services
OPENAI_API_KEY=sk-prod-...
ANTHROPIC_API_KEY=sk-ant-...

# Production Settings
ENVIRONMENT=production
LOG_LEVEL=INFO
DEBUG=False
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    redis-server \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install chromium --with-deps

# Copy application
COPY backend/ .

# Expose ports
EXPOSE 8000

# Start services
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: upm_plus
      POSTGRES_USER: upm
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"
  
  api:
    build: .
    ports:
      - "8000:8000"
    depends_on:
      - redis
      - postgres
    environment:
      - DATABASE_URL=postgresql+asyncpg://upm:secret@postgres/upm_plus
      - REDIS_URL=redis://redis:6379/0
  
  celery:
    build: .
    command: celery -A app.services.task_executor worker --loglevel=info
    depends_on:
      - redis
      - postgres
    environment:
      - DATABASE_URL=postgresql+asyncpg://upm:secret@postgres/upm_plus
      - REDIS_URL=redis://redis:6379/0
```

**Start everything:**
```bash
docker-compose up -d
```

---

## 🚨 Troubleshooting

### Common Issues:

**1. Module Not Found Errors**
```bash
# Solution: Install missing dependency
pip install <package-name>

# Or reinstall all
pip install -r backend/requirements.txt
```

**2. Redis Connection Error**
```bash
# Solution: Start Redis
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:7-alpine
```

**3. Playwright Browser Not Found**
```bash
# Solution: Install browsers
playwright install chromium firefox webkit
```

**4. OpenAI API Key Error**
```bash
# System works in fallback mode without API keys
# But for full functionality, add to .env:
OPENAI_API_KEY=sk-...
```

**5. Database Migration Issues**
```bash
# Solution: Reset database
rm upm_plus.db
python -c "from app.core.database import init_db; import asyncio; asyncio.run(init_db())"
```

---

## 📚 Next Steps

### 1. Explore the API
- Open http://localhost:8000/docs (Swagger UI)
- Try the interactive API documentation
- Test endpoints with your data

### 2. Customize Agents
- Modify `backend/app/agents/browser_agent.py` for custom browser actions
- Extend `backend/app/agents/conversational_agent.py` for your AI logic
- Add new agent types in `backend/app/agents/`

### 3. Build Workflows
- Create custom workflows in `backend/app/workflows/`
- Define task dependencies and parallel execution
- Implement retry logic and error handling

### 4. Scale to Production
- Deploy with Docker Compose or Kubernetes
- Set up monitoring with Prometheus + Grafana
- Configure auto-scaling based on queue length
- Implement rate limiting and authentication

---

## 💡 Pro Tips

### Tip 1: Use Templates for Common Tasks
```python
# Use predefined workflow templates
result = await browser_automation_service.execute_template_workflow(
    template_name="web_scraping",
    variables={
        "target_url": "https://yoursite.com",
        "data_selector": ".products"
    }
)
```

### Tip 2: Cache Expensive Operations
```python
# Use Redis for caching
from app.core.redis import redis_client

cache_key = f"price:{product_id}"
cached = await redis_client.get(cache_key)

if not cached:
    # Fetch data
    data = await scrape_price(product_id)
    await redis_client.set(cache_key, data, expire=3600)  # 1 hour
```

### Tip 3: Batch Processing
```python
# Process multiple tasks in parallel
tasks = [create_task(url) for url in urls]
results = await asyncio.gather(*[
    agent.execute_task(task, context) 
    for task in tasks
])
```

### Tip 4: Error Recovery
```python
# Implement retry logic
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def reliable_task():
    return await agent.execute_task(task, context)
```

---

## 🎓 Learning Resources

- **API Documentation:** http://localhost:8000/docs
- **Test Examples:** `/test_agent_system.py` - See real usage
- **Agent Implementations:** `/backend/app/agents/` - Study the code
- **Service Layer:** `/backend/app/services/` - Understand orchestration
- **Business Analysis:** `/UPM_PLUS_BUSINESS_ANALYSIS.md` - Full context

---

## ✅ Quick Validation Checklist

- [ ] Environment setup complete (`.env` file created)
- [ ] Redis running (test: `redis-cli ping` → `PONG`)
- [ ] Dependencies installed (test: `python -c "import playwright"`)
- [ ] Tests passing (test: `python test_agent_system.py` → 8/8 ✅)
- [ ] API responding (test: `curl http://localhost:8000/health`)
- [ ] First automation working (run any example above)

---

## 🚀 You're Ready!

**Your UPM.Plus system is now operational.**

Start with one of the examples above, customize for your use case, and scale from there.

**Need help?** Check the test files for working examples of every feature.

**Questions?** The code is self-documenting - explore `/backend/app/` to see how everything works.

---

**Welcome to the future of automation! 🤖**
