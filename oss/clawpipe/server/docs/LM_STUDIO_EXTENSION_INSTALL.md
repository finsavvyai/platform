# How to Install FinSavvyAI Inside LM Studio

**Two ways to integrate:**
1. ✅ **Recommended: Install as LM Studio Extension** (Full UI integration)
2. ⚙️ **Alternative: Use via API** (Run separately, connect via HTTP)

---

## Method 1: LM Studio Extension (Recommended)

### Prerequisites

- ✅ LM Studio installed and running
- ✅ FinSavvyAI gateway running on port 8080

### Step 1: Start FinSavvyAI Gateway

Open a terminal and run:

```bash
cd /Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm

export FINSAVVYAI_NOTEBOOKLM_ENABLED=true
python3 -m src.api.gateway
```

Keep this terminal open - the gateway needs to stay running!

### Step 2: Install Extension in LM Studio

1. **Open LM Studio** application
2. **Click the Extensions icon** (🧩 puzzle piece) in the left sidebar
3. **Click "Install from Local Folder"** button
4. **Navigate to**: `/Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm/lmstudio-extension`
5. **Select the folder** and click "Open"
6. **Click "Install"** in the confirmation dialog

### Step 3: Activate the Extension

1. **Go back to Extensions** (🧩 icon)
2. **Find "FinSavvyAI"** in your extensions list
3. **Toggle the switch** to ON (should turn blue/green)
4. **A new panel "📚 NotebookLM"** will appear in the left sidebar

### Step 4: Use the Extension

#### Via Sidebar Panel:

1. Click the **"📚 NotebookLM"** panel in the sidebar
2. **Upload a document**:
   - Paste your text in the text area
   - Enter a filename (e.g., `research.txt`)
   - Click "Upload" button
3. **View your sources** in the Sources list
4. **Create notebooks** with the "+ New Notebook" button

#### Via Chat Commands:

In any LM Studio chat, type:

```
/upload This is my document text that I want to upload.
```

```
/sources
```

```
/notebook create My Research Project
```

```
/notebook list
```

---

## Method 2: Use via API (Alternative)

If the extension doesn't work or you prefer using the API directly:

### Step 1: Start Both Services

**Terminal 1 - FinSavvyAI Gateway:**
```bash
cd /Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm
export FINSAVVYAI_NOTEBOOKLM_ENABLED=true
python3 -m src.api.gateway
```

**Terminal 2 - Keep LM Studio open with the server enabled**
- Click the 💬 icon in LM Studio
- Make sure "Enable Server" is ON
- Note the port (default: 1234)

### Step 2: Use via curl or API

```bash
# Upload a document
curl -X POST http://localhost:8080/api/notebook/sources/import \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.txt", "file_type": "text", "content": "Your text here"}'

# List sources
curl http://localhost:8080/api/notebook/sources | jq

# Create notebook
curl -X POST http://localhost:8080/api/notebook/notebooks \
  -H "Content-Type: application/json" \
  -d '{"name": "My Notebook"}'
```

See `docs/TESTING_GUIDE.md` for complete API usage.

---

## Troubleshooting

### Extension Not Appearing

**Problem:** Extension installed but not showing up

**Solutions:**
1. ✅ Verify gateway is running: `curl http://localhost:8080/health`
2. ✅ Restart LM Studio completely
3. ✅ Make sure extension is enabled (toggle is ON)
4. ✅ Check LM Studio console for errors (View → Toggle Developer Tools)

### "Cannot Connect to Gateway" Error

**Problem:** Extension can't reach the FinSavvyAI gateway

**Solutions:**
1. ✅ Check if gateway is running:
   ```bash
   ps aux | grep "src.api.gateway"
   ```
2. ✅ Restart gateway:
   ```bash
   lsof -ti :8080 | xargs kill -9
   cd /Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm
   export FINSAVVYAI_NOTEBOOKLM_ENABLED=true
   python3 -m src.api.gateway
   ```
3. ✅ Verify port 8080 is accessible: `curl http://localhost:8080/health`

### Uploads Failing

**Problem:** Documents won't upload

**Solutions:**
1. ✅ Check gateway health: `curl http://localhost:8080/health`
2. ✅ Look at gateway terminal for error messages
3. ✅ Try using the API directly:
   ```bash
   curl -X POST http://localhost:8080/api/notebook/sources/import \
     -H "Content-Type: application/json" \
     -d '{"filename": "test.txt", "file_type": "text", "content": "test"}'
   ```

### Extension Commands Not Working

**Problem:** `/upload`, `/sources` commands don't work

**Solutions:**
1. ✅ Make sure extension is enabled
2. ✅ Try starting a new chat
3. ✅ Check LM Studio console (F12) for errors
4. ✅ Verify gateway is running

---

## Quick Start After Installation

Once the extension is installed and activated:

### 1. Upload Your First Document

Click the **📚 NotebookLM** panel, then:
1. Paste some text in the text area
2. Enter a filename
3. Click **"Upload"**

### 2. Create a Notebook

1. Click **"+ New Notebook"**
2. Enter a name
3. Click OK

### 3. Check Everything Works

In the chat panel, type:
```
/sources
```

You should see a list of your uploaded documents!

---

## What's Working

✅ **Sidebar Panel** - Upload documents, view sources, create notebooks
✅ **Chat Commands** - `/upload`, `/sources`, `/notebook`
✅ **Real-time Updates** - Sources and notebooks sync automatically
✅ **Persistent Storage** - All data saved to disk

## Coming Soon

⏳ RAG queries inside LM Studio chat
⏳ Source citations in responses
⏳ Voice interface
⏳ Document preview panel

---

## Need Help?

1. Check the gateway is running: `curl http://localhost:8080/health`
2. Look at terminal output for errors
3. Check LM Studio console (View → Toggle Developer Tools)
4. See `docs/TESTING_GUIDE.md` for more examples

**Enjoy your local LLM platform with NotebookLM features! 🚀**
