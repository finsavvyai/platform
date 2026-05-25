# 🌐 Luna Vision RAG™ MCP Server (Cloudflare Workers)

**HTTP-based MCP server deployed on Cloudflare Workers**

Provides MCP protocol over HTTP for Claude Desktop and other MCP clients.

---

## 🚀 Quick Deploy

```bash
cd mcp-servers/luna-vision-rag-mcp
npm install
wrangler deploy
```

---

## 🌍 Live URLs

- **Workers.dev**: https://luna-vision-rag-mcp.broad-dew-49ad.workers.dev
- **Custom Domain**: https://mcp.lunaos.ai (after DNS setup)
- **MCP Endpoint**: `/mcp` (POST)
- **Health Check**: `/health` (GET)

---

## 📡 MCP Protocol

This server implements MCP over HTTP using JSON-RPC 2.0.

### **Endpoint**: `POST /mcp`

### **Request Format**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### **Response Format**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [...]
  }
}
```

---

## 🛠️ Available Methods

### **initialize**
Initialize MCP session

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    }
  }
}
```

### **tools/list**
List all available tools

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

### **tools/call**
Call a specific tool

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "rag_query",
    "arguments": {
      "query": "How is authentication implemented?",
      "collectionName": "my-project",
      "topK": 5
    }
  }
}
```

---

## 🧪 Testing

### **Test Health**
```bash
curl https://luna-vision-rag-mcp.broad-dew-49ad.workers.dev/health
```

### **Test MCP Initialize**
```bash
curl -X POST https://luna-vision-rag-mcp.broad-dew-49ad.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {}
    }
  }'
```

### **Test Tools List**
```bash
curl -X POST https://luna-vision-rag-mcp.broad-dew-49ad.workers.dev/mcp \
  -H "Content-Type": application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

### **Test Tool Call**
```bash
curl -X POST https://luna-vision-rag-mcp.broad-dew-49ad.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "health_check",
      "arguments": {}
    }
  }'
```

---

## 🔧 Configuration

### **Claude Desktop Config**

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "luna-vision-rag": {
      "url": "https://luna-vision-rag-mcp.broad-dew-49ad.workers.dev/mcp"
    }
  }
}
```

Or with custom domain:

```json
{
  "mcpServers": {
    "luna-vision-rag": {
      "url": "https://mcp.lunaos.ai/mcp"
    }
  }
}
```

---

## 🌐 Custom Domain Setup

### **1. Add Custom Domain in Cloudflare**

1. Go to: Workers & Pages → luna-vision-rag-mcp
2. Click: Settings → Domains & Routes
3. Click: Add Custom Domain
4. Enter: `mcp.lunaos.ai`
5. Click: Add Domain

### **2. Verify DNS**

```bash
dig mcp.lunaos.ai
```

### **3. Test**

```bash
curl https://mcp.lunaos.ai/health
```

---

## 📊 Architecture

```
┌─────────────────┐
│  Claude Desktop │
└────────┬────────┘
         │ HTTP/JSON-RPC
         │
┌────────▼──────────────────┐
│ mcp.lunaos.ai             │
│ (Cloudflare Workers)      │
│ - MCP Protocol Handler    │
│ - Tool Routing            │
└────────┬──────────────────┘
         │ HTTPS
         │
┌────────▼──────────────────┐
│ rag.lunaos.ai             │
│ (Cloudflare Workers)      │
│ - RAG API                 │
│ - GLM Vision API          │
│ - Integration API         │
└───────────────────────────┘
```

---

## 🛠️ Development

### **Local Development**
```bash
wrangler dev
```

### **Deploy**
```bash
wrangler deploy
```

### **View Logs**
```bash
wrangler tail
```

---

## 📝 Environment Variables

Set in `wrangler.toml`:

- `ENVIRONMENT` - Environment name (production)
- `APP_NAME` - Application name
- `APP_VERSION` - Version number
- `API_BASE_URL` - Base URL for RAG API

---

## 🎯 Benefits of Cloudflare Deployment

✅ **Global CDN** - 200+ data centers  
✅ **Low Latency** - Sub-50ms response time  
✅ **High Availability** - 99.99% uptime SLA  
✅ **Auto Scaling** - Handles any load  
✅ **HTTPS** - Automatic SSL/TLS  
✅ **DDoS Protection** - Built-in security  
✅ **Zero Config** - No server management  

---

## 🔗 Links

- **API**: https://rag.lunaos.ai
- **MCP Server**: https://mcp.lunaos.ai
- **GitHub**: https://github.com/shacharsol/luna-agent
- **Documentation**: `/LUNA_VISION_RAG_INTEGRATION.md`

---

**Luna Vision RAG™ - MCP Server on Cloudflare Workers** 🚀
