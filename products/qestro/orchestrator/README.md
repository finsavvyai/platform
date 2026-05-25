# 🤖 Qestro AI Orchestrator

**One Command to Build Complete Features**

The Qestro AI Orchestrator is a unified AI system that coordinates multiple AI tools and agents to implement features, fix bugs, create UI, and generate tests - all from a single command.

## 🚀 Quick Start

```bash
# Install
cd orchestrator
pip install -e .

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Run
qestro-ai feature "Build a self-healing test locator system"
```

## 📋 Commands

### Feature Implementation
```bash
# Build a complete feature end-to-end
qestro-ai feature "Build a test recording browser extension integration"

# Dry run - see plan without implementing
qestro-ai feature "Add visual regression testing" --dry-run

# Create on a new branch
qestro-ai feature "Add API connector generation" --branch feature/api-connectors
```

### Bug Fixing
```bash
# Auto-fix a bug
qestro-ai fix "Login page not redirecting after authentication"

# Fix a specific file
qestro-ai fix "Form validation not working" --file frontend/src/pages/LoginPage.tsx
```

### UI Creation
```bash
# Create UI with Bolt.new prototype first
qestro-ai ui "Create an analytics dashboard with charts and filters"

# Skip prototype, implement directly
qestro-ai ui "Add a test status card component" --no-prototype
```

### Test Generation
```bash
# Generate all test types
qestro-ai test "PaymentService"

# Specific test type
qestro-ai test "checkout flow" --type e2e
qestro-ai test "UserService.validateEmail" --type unit
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI (main.py)                            │
│   qestro-ai feature | fix | ui | test                       │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                       CREWS                                  │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌────────────┐ │
│  │FeatureCrew │ │ BugfixCrew │ │  UICrew   │ │ TestCrew   │ │
│  └────────────┘ └────────────┘ └───────────┘ └────────────┘ │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                       AGENTS                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Planner  │ │ Backend  │ │ Frontend │ │  Tester  │ ...   │
│  │  Agent   │ │   Dev    │ │   Dev    │ │  Agent   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                       TOOLS                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │OpenHands │ │ Bolt.new │ │ File Ops │ │Test Run  │ ...   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Tools

| Tool | Purpose | Source |
|------|---------|--------|
| **OpenHands** | AI code generation | Your deployed Cloudflare Worker |
| **Bolt.new** | UI prototyping | Automated or prompt generation |
| **File Ops** | Read/write/search files | Local filesystem |
| **Git** | Version control | Local git |
| **Test Runner** | Run tests | Jest, Vitest, Playwright |

## 🤖 Agents

| Agent | Role | Tools |
|-------|------|-------|
| **Planner** | Break down features, decide tools | File search, Directory list |
| **Backend Dev** | Implement Node.js/Express code | OpenHands, File ops, Type check |
| **Frontend Dev** | Implement React components | OpenHands, Bolt.new, File ops |
| **Tester** | Generate and run tests | Test generator, Test runner |
| **Reviewer** | Review code quality | Type check, Lint, Test runner |

## ⚙️ Configuration

### Required Environment Variables

```bash
OPENAI_API_KEY=sk-...          # Required for CrewAI
OPENHANDS_API_URL=https://...  # Your OpenHands AI Engine
```

### Optional Configuration

```bash
ANTHROPIC_API_KEY=...          # For Claude-based agents
ENABLE_BOLT_AUTOMATION=true    # Full Bolt.new automation
ENABLE_AUTO_COMMIT=true        # Auto-commit changes
```

## 📁 Project Structure

```
orchestrator/
├── orchestrator/
│   ├── main.py           # CLI entry point
│   ├── agents/           # AI agent definitions
│   │   ├── planner.py
│   │   ├── backend_dev.py
│   │   ├── frontend_dev.py
│   │   ├── tester.py
│   │   └── reviewer.py
│   ├── crews/            # Agent orchestration
│   │   ├── feature_crew.py
│   │   ├── bugfix_crew.py
│   │   ├── ui_crew.py
│   │   └── test_crew.py
│   └── tools/            # Tool implementations
│       ├── openhands.py
│       ├── bolt_api.py
│       ├── file_ops.py
│       ├── git_ops.py
│       └── test_runner.py
├── pyproject.toml
├── .env.example
└── README.md
```

## 🔄 Workflows

### Feature Implementation Workflow

```
1. PLANNING
   └── Planner Agent analyzes requirements
   └── Creates task breakdown
   └── Identifies affected files

2. BACKEND IMPLEMENTATION
   └── Backend Dev Agent implements
   └── Uses OpenHands for code generation
   └── Creates services, routes, schemas

3. FRONTEND IMPLEMENTATION
   └── Frontend Dev Agent implements
   └── Optional: Uses Bolt.new for prototyping
   └── Creates components, pages

4. TEST GENERATION
   └── Tester Agent generates tests
   └── Uses OpenHands Test Generator
   └── Creates unit, integration, E2E tests

5. VALIDATION
   └── Reviewer Agent validates
   └── Runs type checking, linting, tests
   └── Reports any issues
```

## 🧪 Examples

### Example 1: Complete Feature

```bash
qestro-ai feature "Implement a self-healing test system that:
- Automatically detects broken selectors
- Suggests alternative selectors
- Tracks healing history
- Provides healing reports"
```

### Example 2: Quick Bug Fix

```bash
qestro-ai fix "The test execution status is not updating in real-time on the Runs page"
```

### Example 3: UI Component

```bash
qestro-ai ui "Create a test recording player that shows:
- Video of the test execution
- Step-by-step timeline
- Screenshots at each step
- Hover to preview functionality"
```

## 🤝 Integration with Other Tools

### With Cursor AI
The orchestrator handles the heavy lifting. Use Cursor for:
- Quick edits after orchestrator runs
- Debugging specific issues
- Code exploration

### With Windsurf
Use Windsurf when you need:
- Interactive guidance
- Complex refactoring review
- Real-time collaboration

### With Bolt.new
The orchestrator can:
- Generate prompts for Bolt.new
- (With automation) Auto-interact with Bolt.new
- Import generated code

## 📈 Roadmap

- [ ] Full Bolt.new browser automation
- [ ] LangGraph integration for complex flows
- [ ] Self-healing workflow loops
- [ ] GitHub/GitLab PR integration
- [ ] Slack notifications
- [ ] Dashboard for monitoring

## 📝 License

MIT License - Part of the Qestro Platform
