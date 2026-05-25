# 🌟 Luna Vision RAG™ MCP Client

Connect Claude Code to the Luna Vision RAG™ API at **rag.lunaos.ai**

This MCP server provides 11 powerful tools for context-aware GUI testing, code analysis, and automated test generation.

---

## 🚀 Quick Start

### **1. Install Dependencies**

```bash
cd mcp-servers/luna-vision-rag-client
npm install
```

### **2. Add to Claude Desktop Config**

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "luna-vision-rag": {
      "command": "node",
      "args": [
        "/absolute/path/to/luna-agents/mcp-servers/luna-vision-rag-client/index.js"
      ]
    }
  }
}
```

### **3. Restart Claude Desktop**

The Luna Vision RAG tools will now be available in Claude!

---

## 🛠️ Available Tools

### **RAG Tools** (Context-Aware Code Retrieval)

#### `rag_setup`
Configure RAG system for a project.

```javascript
{
  "projectPath": "/path/to/project",
  "collectionName": "my-project",
  "vectorDB": "pinecone"  // pinecone, weaviate, or qdrant
}
```

#### `rag_query`
Query codebase using natural language.

```javascript
{
  "query": "How do I authenticate users?",
  "collectionName": "my-project",
  "topK": 5
}
```

#### `rag_index`
Index files into vector database.

```javascript
{
  "files": ["/src/auth.ts", "/src/user.ts"],
  "collectionName": "my-project"
}
```

---

### **GLM Vision Tools** (GUI Testing & Analysis)

#### `glm_capture`
Capture screenshot of web page or UI element.

```javascript
{
  "url": "https://example.com",
  "selector": "#login-form",  // optional
  "fullPage": false
}
```

#### `glm_analyze`
Analyze UI screenshot using GLM Vision AI.

```javascript
{
  "screenshotUrl": "https://example.com/screenshot.png",
  "analysisType": "ui-elements"  // ui-elements, layout, accessibility, visual-bugs, comprehensive
}
```

#### `glm_test`
Run automated GUI tests.

```javascript
{
  "testSuite": "login-flow",
  "url": "https://example.com"
}
```

---

### **Integration Tools** (RAG + GLM Vision)

#### `integration_validate`
Validate UI against code specifications.

```javascript
{
  "component": "LoginForm",
  "expectedBehavior": "Should validate email format",
  "context": "User authentication flow"
}
```

#### `integration_generate`
Generate automated tests from codebase understanding.

```javascript
{
  "component": "LoginForm",
  "testType": "e2e",  // unit, integration, e2e, visual
  "coverage": "comprehensive"  // basic, comprehensive, exhaustive
}
```

#### `integration_report`
Generate comprehensive test report.

```javascript
{
  "projectName": "My App",
  "includeMetrics": true
}
```

---

### **Utility Tools**

#### `health_check`
Check if API is healthy.

```javascript
{}
```

#### `api_info`
Get information about available endpoints.

```javascript
{}
```

---

## 📖 Usage Examples

### **Example 1: Query Codebase**

```
User: "How is user authentication implemented in this project?"

Claude uses: rag_query
{
  "query": "user authentication implementation",
  "collectionName": "my-project",
  "topK": 5
}

Returns: Relevant code snippets with context
```

### **Example 2: Analyze UI**

```
User: "Analyze the login page for accessibility issues"

Claude uses: glm_analyze
{
  "screenshotUrl": "https://myapp.com/login",
  "analysisType": "accessibility"
}

Returns: Accessibility analysis with recommendations
```

### **Example 3: Generate Tests**

```
User: "Generate E2E tests for the LoginForm component"

Claude uses: integration_generate
{
  "component": "LoginForm",
  "testType": "e2e",
  "coverage": "comprehensive"
}

Returns: Generated test code
```

---

## 🔧 Configuration

### **Environment Variables** (Optional)

You can override the API base URL:

```bash
export LUNA_RAG_API_BASE="https://rag.lunaos.ai"
```

### **Custom Configuration**

Edit `index.js` to customize:
- API base URL
- Request timeout
- Error handling
- Response formatting

---

## 🧪 Testing

Test the MCP server:

```bash
# Test health check
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"health_check","arguments":{}}}' | node index.js

# Test RAG query
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"rag_query","arguments":{"query":"test","collectionName":"demo","topK":3}}}' | node index.js
```

---

## 📊 Features

✅ **11 Powerful Tools** - RAG, GLM Vision, Integration  
✅ **Context-Aware** - Semantic code understanding  
✅ **GUI Testing** - Automated visual testing  
✅ **Test Generation** - AI-powered test creation  
✅ **Real-time API** - Sub-100ms response time  
✅ **Global CDN** - 200+ edge locations  
✅ **Production Ready** - Deployed on Cloudflare Workers  

---

## 🔗 Links

- **API**: https://rag.lunaos.ai
- **Health**: https://rag.lunaos.ai/health
- **API Info**: https://rag.lunaos.ai/api
- **Documentation**: `/TESTING_GUIDE.md`
- **GitHub**: https://github.com/shacharsol/luna-agent

---

## 🐛 Troubleshooting

### **MCP Server Not Showing in Claude**

1. Check `claude_desktop_config.json` path is correct
2. Ensure `node` is in your PATH
3. Restart Claude Desktop completely
4. Check Claude logs: `~/Library/Logs/Claude/`

### **API Errors**

1. Check API health: `curl https://rag.lunaos.ai/health`
2. Verify internet connection
3. Check API status: https://dash.cloudflare.com

### **Tool Not Working**

1. Check tool name matches exactly
2. Verify required parameters are provided
3. Check response for error messages

---

## 📝 Development

### **Local Development**

```bash
# Install dependencies
npm install

# Run server
npm start

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node index.js
```

### **Adding New Tools**

1. Add tool definition in `ListToolsRequestSchema` handler
2. Add tool implementation in `CallToolRequestSchema` handler
3. Update README with tool documentation
4. Test with MCP Inspector

---

## 🎯 Roadmap

- [ ] Add caching for faster responses
- [ ] Add batch operations
- [ ] Add streaming responses
- [ ] Add authentication support
- [ ] Add rate limiting
- [ ] Add metrics and monitoring
- [ ] Add offline mode

---

## 📞 Support

- **Issues**: https://github.com/shacharsol/luna-agent/issues
- **Discussions**: https://github.com/shacharsol/luna-agent/discussions
- **Email**: support@lunaos.ai

---

**Luna Vision RAG™ - The world's first context-aware GUI testing platform** 🚀
