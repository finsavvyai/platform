# Getting Started with Luna Agents

**Time to Complete**: 15-20 minutes
**What You'll Build**: A complete feature from requirements to deployment

Welcome to Luna Agents! In this guide, you'll learn how to use AI-powered agents to automate your entire development lifecycle. By the end, you'll have completed a real project using Luna's intelligent agents.

---

## What is Luna Agents?

Luna Agents is a complete AI-powered development lifecycle platform that automates everything from requirements analysis to post-launch monitoring. Instead of juggling 10+ tools (GitHub Copilot, Jira, Playwright, Vercel, DataDog), you get 15+ specialized AI agents in one platform.

**Your entire dev team, powered by AI.**

### What You Get

- **10 Core Agents**: Requirements → Documentation (Free tier)
- **5+ Premium Agents**: UI testing, deployment, monitoring (Pro tier)
- **Luna RAG™**: Semantic code search that understands your codebase
- **MCP Integration**: Works with Claude, Cursor, Windsurf, Zed, and more
- **Global Performance**: Cloudflare-powered edge deployment

---

## Prerequisites

Before you start, make sure you have:

- ✅ **MCP-Compatible Platform**: Claude Desktop, Windsurf, Cursor, Cline, or Zed
- ✅ **Node.js 18+**: [Download here](https://nodejs.org/)
- ✅ **Git**: [Download here](https://git-scm.com/)
- ✅ **Terminal Access**: Command line / Terminal app
- ✅ **5-10 Minutes**: For installation and setup

---

## Step 1: Installation (5 minutes)

### Quick Install

Open your terminal and run:

```bash
# Clone the repository
git clone https://github.com/shacharsol/luna-agent.git
cd luna-agent

# Run automated setup
./setup.sh
```

**That's it!** The setup script will:
- ✅ Check prerequisites (Node.js, Git, npm)
- ✅ Install Luna RAG dependencies
- ✅ Configure MCP servers automatically
- ✅ Install Luna Agents plugin
- ✅ Update your MCP configuration
- ✅ Create quick reference guide

### What Gets Installed

**1. Luna RAG MCP Server** (Local semantic search)
- Indexes your codebase for intelligent search
- Pattern recognition and best practices extraction
- Natural language code queries

**2. Luna Vision RAG™ MCP Server** (Cloud-based, Premium)
- GUI testing and screenshot analysis
- No local process needed - runs in the cloud!
- Premium feature with API key

**3. Luna Agents Plugin** (15+ AI agents)
- Requirements analyzer, design architect, task planner
- Code review, testing, deployment automation
- Documentation, monitoring, post-launch review

### Verify Installation

After setup completes, **restart your AI coding assistant** (Claude Desktop, Cursor, etc.).

Then verify everything works:

```
In your AI assistant, type:
"Use the health_check tool"
```

You should see a successful health check response from Luna Vision RAG.

### Troubleshooting

**"Command not found: ./setup.sh"**
- Make sure you're in the `luna-agent` directory
- Make the script executable: `chmod +x setup.sh`

**"Node.js not found"**
- Install Node.js 18+ from [nodejs.org](https://nodejs.org/)
- Restart your terminal after installation

**"MCP configuration not found"**
- The script will prompt you for your MCP config location
- Common locations:
  - Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windsurf: `~/Library/Application Support/Windsurf/config.json`
  - Zed: `~/.config/zed/settings.json`

---

## Step 2: Your First Luna RAG Query (2 minutes)

Let's test Luna's intelligent code search. This works even if you don't have a project yet!

### Example 1: Understanding Your Codebase

```
In your AI assistant, type:

"Use Luna RAG to search my codebase: How does authentication work?"
```

Luna will:
1. Index your codebase semantically
2. Find all authentication-related code
3. Explain the flow and patterns
4. Show you the most relevant files

### Example 2: Find Coding Patterns

```
"Use Luna RAG to find all API endpoints in this project"
```

Luna will identify and list all endpoints with their methods, paths, and handlers.

### Example 3: Best Practices

```
"Use Luna RAG to show me all error handling patterns"
```

Luna will extract error handling approaches used in your codebase.

**🎉 Congratulations!** You've just experienced intelligent code search. This is just the beginning.

---

## Step 3: Complete Development Workflow (15 minutes)

Now let's build a real feature using Luna's complete agent workflow. We'll create a "User Profile" feature from scratch.

### Create a New Project

If you don't have a project, let's create one:

```bash
mkdir my-saas-app
cd my-saas-app
git init
```

### The Luna Workflow

Luna follows a proven development lifecycle:

```
1. Requirements → 2. Design → 3. Planning → 4. Execution →
5. Review → 6. Testing → 7. Deployment → 8. Documentation →
9. Monitoring → 10. Post-Launch
```

Let's walk through it!

---

### 1. Requirements Analysis (2 minutes)

**What it does**: Analyzes your codebase and generates comprehensive requirements

In your AI assistant:
```
/luna-requirements
```

When prompted for scope, type: `user-profile`

**What happens**:
- Luna analyzes your project structure
- Identifies technical constraints
- Generates detailed requirements document
- Saves to `.luna/my-saas-app/user-profile/requirements.md`

**Expected output**:
```markdown
# User Profile Feature - Requirements

## Business Requirements
- Users can view their profile information
- Users can edit their profile (name, email, bio)
- Profile pictures with upload capability

## Technical Requirements
- RESTful API endpoints
- Database schema for user profiles
- Frontend form with validation
...
```

---

### 2. Design Architecture (2 minutes)

**What it does**: Creates detailed technical design and architecture

```
/luna-design
```

When prompted, type: `user-profile`

**What happens**:
- Reads the requirements
- Designs system architecture
- Creates API specifications
- Defines database schema
- Saves to `.luna/my-saas-app/user-profile/design.md`

**Expected output**:
```markdown
# User Profile Feature - Technical Design

## Architecture
- Frontend: React component with form validation
- Backend: Express API with 3 endpoints
- Database: PostgreSQL with users and profiles tables

## API Endpoints
- GET /api/profile/:userId
- PUT /api/profile/:userId
- POST /api/profile/upload-picture

## Database Schema
...
```

---

### 3. Task Planning (1 minute)

**What it does**: Breaks design into actionable, ordered tasks

```
/luna-plan
```

When prompted, type: `user-profile`

**What happens**:
- Reads design document
- Creates dependency-ordered task list
- Estimates effort per task
- Defines acceptance criteria
- Saves to `.luna/my-saas-app/user-profile/implementation-plan.md`

**Expected output**:
```markdown
# User Profile Feature - Implementation Plan

## Tasks

### Phase 1: Database Setup
- [x] Task 1.1: Create database migration for profiles table (30 min)
- [ ] Task 1.2: Add indexes for performance (15 min)

### Phase 2: Backend API
- [ ] Task 2.1: Implement GET /api/profile/:userId (45 min)
- [ ] Task 2.2: Implement PUT /api/profile/:userId (60 min)
...
```

---

### 4. Task Execution (5 minutes)

**What it does**: Implements code following the plan

```
/luna-execute
```

When prompted, type: `user-profile`

**What happens**:
- Reads the implementation plan
- Finds the first incomplete task
- Implements it with quality standards
- Marks task as complete
- Tracks progress

**Run multiple times** until all tasks are complete:
```
/luna-execute  (Task 1.1 complete)
/luna-execute  (Task 1.2 complete)
/luna-execute  (Task 2.1 complete)
...continue until done
```

**Expected output**:
Each run implements one task:
```
✅ Task 1.1 Complete: Created database migration
   - Created: migrations/20250101_add_profiles_table.sql
   - Added: Profile model with validation
   - Tests: Unit tests for Profile model
```

**Pro Tip**: Luna automatically:
- Follows coding standards
- Writes comprehensive tests
- Adds helpful comments
- Validates against requirements

---

### 5. Code Review (1 minute)

**What it does**: Automated quality and security assessment

```
/luna-review
```

When prompted, type: `user-profile`

**What happens**:
- Analyzes all implemented code
- Checks for security vulnerabilities
- Validates coding standards
- Provides improvement suggestions
- Saves to `.luna/my-saas-app/user-profile/code-review-report.md`

**Expected output**:
```markdown
# Code Review Report

## Summary
✅ Overall Quality: Excellent
✅ Security: No vulnerabilities found
⚠️  Performance: 2 minor suggestions

## Findings
1. ✅ Input validation implemented correctly
2. ✅ SQL injection prevention using parameterized queries
3. ⚠️  Suggestion: Add database connection pooling
...
```

---

### 6. Testing & Validation (2 minutes)

**What it does**: Creates and runs comprehensive test suites

```
/luna-test
```

When prompted, type: `user-profile`

**What happens**:
- Generates unit tests
- Creates integration tests
- Runs all tests
- Validates requirements coverage
- Saves to `.luna/my-saas-app/user-profile/test-validation-report.md`

**Expected output**:
```markdown
# Test Validation Report

## Test Coverage
✅ Unit Tests: 95% coverage
✅ Integration Tests: All endpoints tested
✅ Requirements: 100% validated

## Test Results
✅ 45 tests passed
❌ 0 tests failed

## Requirements Coverage
✅ BR-1: User can view profile
✅ BR-2: User can edit profile
✅ BR-3: Profile picture upload
...
```

---

### 7. Deployment (1 minute)

**What it does**: Deploys to production (Cloudflare Workers)

```
/luna-deploy
```

When prompted, type: `user-profile`

**What happens**:
- Creates deployment configuration
- Sets up CI/CD pipeline
- Deploys to Cloudflare Workers
- Configures monitoring
- Saves to `.luna/my-saas-app/user-profile/deployment-report.md`

**Expected output**:
```markdown
# Deployment Report

## Deployment Status
✅ Deployed to: https://my-saas-app.workers.dev
✅ Environment: Production
✅ Health Check: Passing

## Deployment Details
- Platform: Cloudflare Workers
- Regions: Global (200+ locations)
- Latency: <10ms average
- SSL: Auto-configured

## Next Steps
- Monitor: https://dash.cloudflare.com
...
```

---

### 8. Documentation (1 minute)

**What it does**: Auto-generates technical documentation

```
/luna-docs
```

When prompted, type: `user-profile`

**What happens**:
- Generates API documentation
- Creates user guide
- Writes developer docs
- Saves to `docs/user-profile/`

**Expected output**:
```markdown
# User Profile API Documentation

## Endpoints

### GET /api/profile/:userId
Retrieves user profile information

**Request**
...

### PUT /api/profile/:userId
Updates user profile

**Request Body**
...
```

---

### 9. Monitoring (Optional - Pro Tier)

**What it does**: Sets up production monitoring

```
/luna-monitor
```

When prompted, type: `user-profile`

Creates dashboards, alerts, and health checks.

---

### 10. Post-Launch Review (After 7 days)

**What it does**: Analyzes production performance

```
/luna-postlaunch
```

Provides optimization recommendations based on real usage data.

---

## Step 4: Explore Premium Features (Optional)

### Upgrade to Pro ($29/month)

Pro tier unlocks:
- 🎨 **Luna UI Testing**: Automated Playwright tests
- 🔧 **Luna UI Fix**: Auto-fix UI issues
- 🚀 **Luna Cloudflare Deploy**: One-click deployment
- 🔍 **Unlimited Luna RAG**: No query limits
- 📊 **Advanced Analytics**: Usage insights

### Get Your API Key

1. Visit [agent.lunaos.ai/pricing](https://agent.lunaos.ai/pricing)
2. Subscribe to Pro or Team
3. Copy your API key
4. Configure in your MCP client:

```json
{
  "mcpServers": {
    "luna-vision-rag": {
      "url": "https://luna-vision-rag-mcp.workers.dev/mcp",
      "headers": {
        "X-API-Key": "luna_YOUR_API_KEY_HERE"
      }
    }
  }
}
```

---

## Quick Reference

### Common Commands

```bash
# Complete workflow
/luna-requirements    # Step 1: Analyze & generate requirements
/luna-design          # Step 2: Create technical design
/luna-plan            # Step 3: Break into tasks
/luna-execute         # Step 4: Implement (run multiple times)
/luna-review          # Step 5: Code review
/luna-test            # Step 6: Test & validate
/luna-deploy          # Step 7: Deploy to production
/luna-docs            # Step 8: Generate documentation

# Intelligence & Search
/luna-rag             # Semantic code search
/luna-rag search      # Search with natural language
/luna-rag index       # Re-index your codebase
/luna-rag patterns    # Extract coding patterns

# UI/UX (Pro)
/luna-ui-test         # Comprehensive UI testing
/luna-ui-fix          # Auto-fix UI issues
/luna-hig             # Apple HIG compliance
```

### File Locations

All Luna files are in `.luna/[project-name]/[feature-name]/`:

```
.luna/
└── my-saas-app/
    └── user-profile/
        ├── requirements.md
        ├── design.md
        ├── implementation-plan.md
        ├── code-review-report.md
        ├── test-validation-report.md
        └── deployment-report.md
```

### Tips for Success

**1. Use Consistent Scope**
Always use the same project/feature name across commands.

✅ Good:
```
/luna-requirements user-profile
/luna-design user-profile
/luna-plan user-profile
```

❌ Bad:
```
/luna-requirements user-profile
/luna-design userProfile
/luna-plan user_profile
```

**2. Run Execute Multiple Times**
Don't expect one `/luna-execute` to complete everything. Run it 10-20+ times until all tasks are done.

**3. Check Reports After Each Step**
Review the generated documents in `.luna/` to ensure quality.

**4. Use Luna RAG First**
Before starting new work, use `/luna-rag` to understand existing code.

---

## Next Steps

### Learn More

- 📚 **[Full Documentation](https://agent.lunaos.ai/docs)**: Complete reference
- 🎥 **[Video Tutorials](https://youtube.com/@lunaagents)**: Visual guides
- 💬 **[Discord Community](https://discord.gg/lunaagents)**: Get help, share projects
- 🐦 **[Twitter](https://twitter.com/lunaagents)**: Updates and tips

### Build Something Amazing

Try these project ideas:
- 📝 **Blog Platform**: Complete CRUD with authentication
- 🛒 **E-commerce Store**: Products, cart, checkout
- 📊 **Analytics Dashboard**: Data visualization
- 🤖 **AI Chatbot**: OpenAI integration
- 📱 **Mobile API**: RESTful backend for apps

### Share Your Success

Built something cool with Luna? Share it!
- Add badge to README: `[![Built with Luna Agents](badge-url)](luna-url)`
- Post in `#showcase` on Discord
- Tweet with `#LunaAgents`
- Get featured on our homepage!

---

## Troubleshooting

### Common Issues

**"Command not found: /luna-requirements"**
- Make sure Luna Agents plugin is installed
- Restart your AI coding assistant
- Check MCP configuration

**"Missing prerequisites: requirements.md"**
- Run commands in order (requirements → design → plan → execute)
- Verify files exist in `.luna/` directory

**"API key invalid" (Premium features)**
- Verify API key format: `luna_AbCdEfGh1234567890IjKlMnOpQrSt`
- Check subscription is active at [agent.lunaos.ai/dashboard](https://agent.lunaos.ai/dashboard)
- Ensure MCP config includes API key in headers

**"Slow performance or timeouts"**
- Large codebases take longer to index
- Use `/luna-rag index` to re-index if needed
- Consider upgrading to Pro for priority processing

### Getting Help

**Free Support**:
- 📖 [Documentation](https://agent.lunaos.ai/docs)
- 💬 [Discord Community](https://discord.gg/lunaagents)
- ❓ [FAQ](https://agent.lunaos.ai/faq)

**Pro/Team Support**:
- 📧 Email: support@lunaos.ai
- 🎯 Priority response: <24 hours
- 💬 Dedicated support + SLA (Team)

---

## Success Stories

> "Luna Agents helped me ship a full SaaS in 2 weeks that would have taken 2 months. The complete lifecycle automation is a game-changer." - **Sarah Chen**, Indie Developer

> "We use Luna for all client projects now. The consistency and quality have been incredible. Highly recommend!" - **TechFlow Agency**

> "I was skeptical about AI development tools, but Luna's intelligent code understanding and end-to-end workflow won me over." - **Marcus Johnson**, Senior Developer

---

## What's Next?

You now know how to:
- ✅ Install and configure Luna Agents
- ✅ Use Luna RAG for intelligent code search
- ✅ Complete a full development workflow
- ✅ Build features from requirements to deployment

**Keep building, keep shipping, and let Luna handle the heavy lifting!**

---

**🌙 Built with Luna Agents? We'd love to hear about it!**

Share your experience:
- Discord: [Join our community](https://discord.gg/lunaagents)
- Twitter: [@lunaagents](https://twitter.com/lunaagents)
- Email: hello@lunaos.ai

**Happy building! 🚀**
