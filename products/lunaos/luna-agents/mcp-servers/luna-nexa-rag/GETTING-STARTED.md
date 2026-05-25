# 🚀 Getting Started with Luna RAG

## ⚠️ Prerequisites

Before using Luna RAG, you need:

1. **Docker Desktop** - For running ChromaDB
2. **Node.js 18+** - Already installed ✅
3. **npm packages** - Already installed ✅

---

## 🔧 Quick Setup (3 Steps)

### Step 1: Start Docker Desktop

1. Open **Docker Desktop** application
2. Wait for Docker to start (whale icon in menu bar)
3. Verify Docker is running:
   ```bash
   docker info
   ```

### Step 2: Start ChromaDB

```bash
./start-chroma.sh
```

**OR manually:**
```bash
docker run -d --name luna-chroma -p 8000:8000 chromadb/chroma
```

### Step 3: Run the Demo

```bash
node rag-demo.js
```

---

## 🎯 What Each Component Does

### ChromaDB
- **Purpose**: Vector database for semantic search
- **Runs on**: http://localhost:8000
- **Storage**: Stores code embeddings for fast similarity search

### Luna RAG Server
- **Purpose**: MCP server that provides RAG tools
- **Runs on**: stdio (communicates with your IDE)
- **Tools**: 26 tools including semantic search, UI testing, code analysis

---

## 📝 Full Workflow

### 1. Start ChromaDB
```bash
# Start Docker first, then:
./start-chroma.sh

# Verify it's running:
curl http://localhost:8000/api/v1/heartbeat
# Should return: {"nanosecond heartbeat": ...}
```

### 2. Configure Your Project
```bash
npm run setup
```

Follow the prompts to configure:
- Project path to index
- ChromaDB host/port (default: localhost:8000)
- Collection name
- File extensions to include

### 3. Start the MCP Server
```bash
npm start
```

This starts the MCP server that your IDE connects to.

### 4. Use from Your IDE

Once the server is running, you can use tools like:
- `index_codebase` - Index your project
- `semantic_search` - Search with natural language
- `ui_capture_screenshot` - Capture UI screenshots
- `ui_analyze_screenshot_hig` - Check Apple HIG compliance

---

## 🐛 Troubleshooting

### "Cannot connect to Docker daemon"

**Problem**: Docker is not running

**Solution**:
1. Open Docker Desktop
2. Wait for it to start completely
3. Try again

### "Could not connect to tenant default_tenant"

**Problem**: ChromaDB is not running

**Solution**:
```bash
# Check if container exists
docker ps -a | grep chroma

# If it exists but stopped:
docker start luna-chroma

# If it doesn't exist:
./start-chroma.sh
```

### "Collection is empty"

**Problem**: You haven't indexed your codebase yet

**Solution**:
1. Start the MCP server: `npm start`
2. Use the `index_codebase` tool from your IDE
3. Wait for indexing to complete
4. Try searching again

### "npm package not found"

**Problem**: Dependencies not installed

**Solution**:
```bash
npm install
```

---

## 🔄 Daily Workflow

### Morning (Start Everything)
```bash
# 1. Start Docker Desktop (if not already running)
# 2. Start ChromaDB
./start-chroma.sh

# 3. Start MCP server (in your IDE or terminal)
npm start
```

### Evening (Stop Everything)
```bash
# Stop ChromaDB container
docker stop luna-chroma

# Stop MCP server
# Press Ctrl+C in the terminal where it's running
```

---

## 📊 Verify Everything is Working

Run the demo script:
```bash
node rag-demo.js
```

Expected output:
```
🌙 Luna RAG Demo

✅ Configuration loaded
   Project: /path/to/your/project
   ChromaDB: localhost:8000
   Collection: your-collection

✅ Connected to collection: your-collection

📊 Collection Statistics:
   Total documents: 0 (or more if already indexed)

🎉 Demo complete!
```

---

## 🎓 Next Steps

1. **Index your first project**:
   - Use `index_codebase` tool from your IDE
   - Point it to a codebase you want to search

2. **Try semantic search**:
   - Use `semantic_search` tool
   - Search for concepts like "authentication" or "database queries"

3. **Test UI/UX features**:
   - Use `ui_capture_screenshot` on a local web app
   - Run `ui_analyze_screenshot_hig` for Apple HIG compliance

---

## 💡 Tips

- **ChromaDB data persists** in the Docker volume, so your indexed code survives restarts
- **MCP server auto-restarts** when files change (if using a process manager)
- **UI testing works** even without ChromaDB (independent feature)

---

## 🆘 Still Having Issues?

1. **Check Docker**:
   ```bash
   docker ps
   # Should show luna-chroma container
   ```

2. **Check ChromaDB**:
   ```bash
   curl http://localhost:8000/api/v1/heartbeat
   ```

3. **Check logs**:
   ```bash
   docker logs luna-chroma
   ```

4. **Restart everything**:
   ```bash
   docker restart luna-chroma
   npm start
   ```

---

**You're ready to use Luna RAG! 🎉**

Start with: `./start-chroma.sh` then `node rag-demo.js`
