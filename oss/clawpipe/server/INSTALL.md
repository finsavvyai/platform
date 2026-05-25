# FinSavvyAI × LM Studio - Quick Install

## 🚀 One-Command Installation

Run the installation script:

```bash
cd /Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm
./install_lm_studio_extension.sh
```

The script will:
- ✅ Check prerequisites
- ✅ Start the FinSavvyAI Gateway (if needed)
- ✅ Verify the gateway is healthy
- ✅ Test all API endpoints
- ✅ Show you installation instructions

---

## 📋 Manual Installation (3 Steps)

If you prefer manual setup:

### Step 1: Start the Gateway

```bash
cd /Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm
export FINSAVVYAI_NOTEBOOKLM_ENABLED=true
python3 -m src.api.gateway
```

Keep this terminal open!

### Step 2: Install Extension in LM Studio

1. Open **LM Studio**
2. Click **🧩 Extensions** (left sidebar)
3. Click **"Install from Local Folder"**
4. Navigate to: `/Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm/lmstudio-extension`
5. Click **"Install"**
6. **Enable the extension** (toggle ON)

### Step 3: Use It!

Click the **"📚 NotebookLM"** panel in LM Studio's sidebar to:
- Upload documents
- View sources
- Create notebooks

---

## ✅ Verification

Test that everything works:

```bash
# Check gateway
curl http://localhost:8080/health | jq

# List sources
curl http://localhost:8080/api/notebook/sources | jq

# Create notebook
curl -X POST http://localhost:8080/api/notebook/notebooks \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}' | jq
```

---

## 📚 What You Get

- 📄 **Document Upload** - Upload text documents directly in LM Studio
- 📚 **Source Management** - View and manage all your documents
- 📓 **Notebooks** - Create organized notebooks for projects
- 💬 **Chat Commands** - Use `/upload`, `/sources`, `/notebook` in chat
- 🔍 **RAG Queries** - Query your documents with AI (coming soon)

---

## 🐛 Troubleshooting

### Gateway not running?

```bash
cd /Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm
export FINSAVVYAI_NOTEBOOKLM_ENABLED=true
python3 -m src.api.gateway
```

### Extension not appearing?

1. Restart LM Studio
2. Make sure extension is enabled (toggle ON)
3. Check LM Studio console (View → Developer Tools)

### Uploads failing?

1. Check gateway health: `curl http://localhost:8080/health`
2. Check logs: `tail -f logs/gateway.log`
3. Make sure both LM Studio and gateway are running

---

## 📖 Documentation

- **Complete Install Guide:** `docs/LM_STUDIO_EXTENSION_INSTALL.md`
- **Testing Guide:** `docs/TESTING_GUIDE.md`
- **Quick Start:** `docs/NOTEBOOKLM_QUICKSTART.md`

---

**Ready? Run `./install_lm_studio_extension.sh` to get started! 🚀**
