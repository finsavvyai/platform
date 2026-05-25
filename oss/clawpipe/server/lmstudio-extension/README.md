# FinSavvyAI Extension for LM Studio

Add NotebookLM features directly inside LM Studio!

## Features

- 📄 **Upload Documents** - Upload text documents directly from LM Studio
- 📚 **Source Management** - View and manage all your uploaded sources
- 📓 **Notebooks** - Create and organize notebooks
- 💬 **Chat Commands** - Use commands in the chat interface
- 🔍 **RAG Queries** - Query your documents with AI (coming soon)

## Installation

### Step 1: Install FinSavvyAI Gateway

```bash
# Navigate to FinSavvyAI directory
cd /Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm

# Start the gateway
export FINSAVVYAI_NOTEBOOKLM_ENABLED=true
python3 -m src.api.gateway
```

The gateway will start on `http://localhost:8080`

### Step 2: Install Extension in LM Studio

1. **Open LM Studio**
2. **Go to Extensions** (click the puzzle icon in the left sidebar)
3. **Click "Install from Local Folder"**
4. **Select this folder**: `/Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm/lmstudio-extension`
5. **Click "Install"**

### Step 3: Activate the Extension

1. **Click the puzzle icon** again
2. **Find "FinSavvyAI"** in the list
3. **Toggle the switch** to enable it
4. **A new "📚 NotebookLM" panel** will appear in the sidebar

## Usage

### Via the Sidebar Panel

1. Click the **"📚 NotebookLM"** panel in the sidebar
2. **Upload Documents**:
   - Paste text in the textarea
   - Enter a filename
   - Click "Upload"
3. **View Sources** - See all uploaded documents
4. **Create Notebooks** - Click "+ New Notebook"

### Via Chat Commands

In any LM Studio chat, use:

```
/upload <your document text>
```
Uploads the text as a document

```
/sources
```
Lists all uploaded sources

```
/notebook create <name>
```
Creates a new notebook

```
/notebook list
```
Lists all notebooks

## Requirements

- LM Studio (latest version)
- FinSavvyAI Gateway running on port 8080
- Both running on the same machine

## Troubleshooting

### Extension not showing up

1. Make sure the gateway is running: `curl http://localhost:8080/health`
2. Restart LM Studio after installing
3. Check LM Studio console for errors

### Can't upload documents

1. Verify gateway is running: `curl http://localhost:8080/health`
2. Check browser console for errors
3. Make sure port 8080 is accessible

### Commands not working

1. Make sure the extension is enabled
2. Try reloading the chat
3. Check LM Studio console for errors

## Development

To modify the extension:

1. Edit `index.js`
2. Reload LM Studio
3. The extension will auto-reload

## Files

- `extension.json` - Extension metadata
- `index.js` - Main extension code
- `README.md` - This file

## Support

For issues or questions:
- GitHub: https://github.com/yourusername/finsavvyai
- Docs: `docs/TESTING_GUIDE.md`

## License

MIT
