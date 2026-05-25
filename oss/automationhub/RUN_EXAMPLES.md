# 🚀 Run UPM.Plus Examples - Step by Step

## ⚡ Quick Run (2 minutes)

```bash
cd /Users/shaharsolomon/dev/projects/github/upm.plus

# Run the master demo
python3.12 examples/complete_automation_examples.py
```

## 📋 Pre-Flight Checklist

### 1. Verify Environment
```bash
# Check Python version
python3.12 --version  # Should be 3.12+

# Verify dependencies
python3.12 -c "import playwright, fastapi, sqlalchemy; print('✅ Dependencies OK')"

# Check Playwright browsers
playwright install --help
```

### 2. Start Required Services

**Option A: Quick Start (No Redis/Celery - Works for most examples)**
```bash
# Just run the examples directly
python3.12 examples/complete_automation_examples.py
```

**Option B: Full Setup (For production features)**
```bash
# Terminal 1: Start Redis (if not running)
redis-server

# Terminal 2: Start Celery (optional, for async tasks)
cd backend
celery -A app.services.task_executor worker --loglevel=info
```

## 🎯 Run Specific Examples

### Browser Automation
```bash
python3.12 examples/01_browser_automation.py
```
**Output**: Web scraping, form filling, screenshots

### Conversational AI
```bash
python3.12 examples/02_conversational_ai.py
```
**Output**: AI conversations, Q&A, chatbots

### E-Commerce Automation
```bash
python3.12 examples/real_world_ecommerce.py
```
**Output**: Price monitoring, inventory tracking, competitor analysis

### All Examples
```bash
python3.12 examples/complete_automation_examples.py
```
**Output**: Complete demo of all 4 agent types

## 🔧 Troubleshooting

### Error: ModuleNotFoundError
```bash
# Install missing packages
pip install -r backend/requirements.txt
```

### Error: Playwright browser not found
```bash
playwright install chromium
```

### Error: Redis connection refused
```bash
# Examples work without Redis for basic features
# For full features, start Redis:
redis-server
```

### Error: OpenAI API key missing
```bash
# System works in fallback mode without API keys
# For full AI features, create .env:
echo "OPENAI_API_KEY=your-key-here" > .env
```

## 📊 What Each Example Demonstrates

| Example | Time | What It Shows |
|---------|------|---------------|
| `complete_automation_examples.py` | 2 min | All 4 agents working |
| `01_browser_automation.py` | 5 min | 8 browser automation patterns |
| `02_conversational_ai.py` | 3 min | 8 conversational AI patterns |
| `real_world_ecommerce.py` | 3 min | 6 e-commerce use cases |

## ✅ Success Indicators

You'll see output like:
```
╔══════════════════════════════════════════════════════════════╗
║           UPM.Plus Complete Automation Demo                 ║
╚══════════════════════════════════════════════════════════════╝

🤖 BROWSER AUTOMATION
============================================================
✅ Status: completed
⏱️  Time: 2134ms
📊 Steps: 4
   📄 navigate: https://example.com
   📄 extract: Example Domain

💬 CONVERSATIONAL AI
============================================================
👤 Q1: What is cloud computing?
🤖 A1: Cloud computing is...

✅ Completed: 8/8 demos
```

## 🎓 Recommended Order

1. **First Run** (2 min)
   ```bash
   python3.12 examples/complete_automation_examples.py
   ```
   See all agents in action

2. **Explore Browser** (5 min)
   ```bash
   python3.12 examples/01_browser_automation.py
   ```
   Learn browser automation

3. **Try E-Commerce** (5 min)
   ```bash
   python3.12 examples/real_world_ecommerce.py
   ```
   See real business value

4. **Customize** (30 min)
   - Edit the example files
   - Change URLs to your targets
   - Add your own workflows

## 🚀 Next Steps After Examples

### Customize for Your Project

1. **Copy an example**
   ```bash
   cp examples/real_world_ecommerce.py my_automation.py
   ```

2. **Modify for your needs**
   ```python
   # Change URL
   task.parameters["actions"][0]["url"] = "https://your-site.com"
   
   # Change selectors
   task.parameters["actions"][1]["selector"] = ".your-selector"
   ```

3. **Run your automation**
   ```bash
   python3.12 my_automation.py
   ```

### Deploy to Production

See `QUICK_START_GUIDE.md` section "Production Deployment" for:
- Docker setup
- Kubernetes deployment
- API integration
- Monitoring setup

## 💡 Pro Tips

1. **Start Small**: Run `complete_automation_examples.py` first
2. **Read Output**: Examples show what's happening in real-time
3. **Check Logs**: Detailed execution info is printed
4. **No API Keys Needed**: Examples work in fallback mode
5. **Screenshots Saved**: Check `examples/` folder for generated files

## 🆘 Need Help?

### Examples not working?
```bash
# Verify installation
python3.12 test_agent_system.py
# Should show 8/8 tests passing
```

### Want different examples?
- Check `examples/README.md` for full list
- Request custom examples in issues

### Ready for production?
- See `UPM_PLUS_BUSINESS_ANALYSIS.md` for use cases
- See `QUICK_START_GUIDE.md` for deployment

---

**Ready? Run your first example now:** 🚀

```bash
python3.12 examples/complete_automation_examples.py
```
