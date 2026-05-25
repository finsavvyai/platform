# 🚀 Luna RAG - Quick Start Guide

## What's New? 🎉

Luna RAG now has **15+ AI-powered tools** beyond basic RAG!

### AI Capabilities Added:

✅ **LangChain Integration** - Advanced AI chains and memory  
✅ **AI Code Review** - Security, performance, style analysis  
✅ **AI Code Explanation** - Detailed code documentation  
✅ **Test Generation** - Auto-generate comprehensive tests  
✅ **Code Refactoring** - Modernize and optimize code  
✅ **Bug Detection** - Find bugs and vulnerabilities  
✅ **Documentation Generation** - Auto-create docs  
✅ **PR Descriptions** - Generate GitHub PR templates  
✅ **Commit Messages** - Conventional commit format  
✅ **Codebase Chat** - Ask questions with memory  
✅ **Codebase Summary** - Architecture analysis  
✅ **Dependency Analysis** - Security audit & updates  
✅ **Sentiment Analysis** - Analyze text sentiment  
✅ **Entity Extraction** - NER for people, orgs, tech  
✅ **Tech Debt Detection** - Find code smells  
✅ **Architecture Recommendations** - Improve design  

---

## 🏃 Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
cd mcp-servers/luna-nexa-rag
npm install
```

### 2. Start Required Services

**ChromaDB (Vector Database):**
```bash
docker run -d -p 8000:8000 chromadb/chroma
```

**Nexa (LLM & Embeddings):**
```bash
nexa server start
# Or with Docker:
docker run -d -p 8080:8080 nexaai/nexa
```

### 3. Configure

Edit `~/.luna-nexa-rag-config.json`:

```json
{
  "projectPath": "/path/to/your/project",
  "collectionName": "my-project",
  "chromaHost": "localhost",
  "chromaPort": 8000,
  "useNexaEmbeddings": true,
  "nexaEndpoint": "http://127.0.0.1:8080",
  "fileTypes": [".js", ".ts", ".tsx", ".jsx", ".py", ".md"]
}
```

### 4. Start the Server

```bash
npm start
# Or:
node index.js
```

---

## 📋 Most Useful Tools

### 1. 🔍 AI Code Review
```javascript
{
  "tool": "ai_code_review",
  "filePath": "./src/App.js",
  "reviewType": "security"
}
```

### 2. 💬 Chat with Codebase
```javascript
{
  "tool": "ai_chat_with_codebase",
  "question": "How does authentication work?",
  "includeContext": true
}
```

### 3. 🧪 Generate Tests
```javascript
{
  "tool": "ai_generate_tests",
  "filePath": "./src/utils/helper.js",
  "testFramework": "jest",
  "coverage": "comprehensive"
}
```

### 4. 📚 Generate Documentation
```javascript
{
  "tool": "ai_generate_documentation",
  "filePath": "./src/api/routes.js",
  "format": "markdown",
  "includeExamples": true
}
```

### 5. ♻️ Refactor Code
```javascript
{
  "tool": "ai_refactor_code",
  "filePath": "./src/legacy/old.js",
  "refactorType": "modernize"
}
```

---

## 🎯 Common Workflows

### Workflow 1: Code Quality Check

1. **Index codebase**
```javascript
{ "tool": "index_codebase" }
```

2. **Review code**
```javascript
{ "tool": "ai_code_review", "filePath": "./src/App.js" }
```

3. **Detect bugs**
```javascript
{ "tool": "ai_detect_bugs", "filePath": "./src/App.js" }
```

4. **Analyze tech debt**
```javascript
{ "tool": "ai_tech_debt_analysis", "scope": "full" }
```

---

### Workflow 2: New Feature Development

1. **Chat about requirements**
```javascript
{ "tool": "ai_chat_with_codebase", "question": "Show me similar features" }
```

2. **Find similar implementations**
```javascript
{ "tool": "get_similar_implementations", "feature": "user authentication" }
```

3. **Generate documentation**
```javascript
{ "tool": "ai_generate_documentation", "filePath": "./src/newFeature.js" }
```

4. **Generate tests**
```javascript
{ "tool": "ai_generate_tests", "filePath": "./src/newFeature.js" }
```

5. **Generate PR description**
```javascript
{ "tool": "ai_generate_pr_description", "branch": "feature/new-auth" }
```

---

### Workflow 3: Codebase Understanding

1. **Summarize codebase**
```javascript
{ "tool": "ai_summarize_codebase", "scope": "full", "detailLevel": "overview" }
```

2. **Analyze dependencies**
```javascript
{ "tool": "ai_analyze_dependencies", "checkSecurity": true }
```

3. **Get architecture recommendations**
```javascript
{ "tool": "ai_architecture_recommendations", "focus": "scalability" }
```

4. **Ask specific questions**
```javascript
{ "tool": "ai_chat_with_codebase", "question": "Explain the data flow" }
```

---

## 🔧 Troubleshooting

### Issue: LLM not initialized

**Solution:** Make sure Nexa server is running:
```bash
nexa server start
# Check: curl http://127.0.0.1:8080/v1/models
```

### Issue: ChromaDB connection failed

**Solution:** Start ChromaDB:
```bash
docker run -d -p 8000:8000 chromadb/chroma
# Check: curl http://localhost:8000/api/v1/heartbeat
```

### Issue: No results from search

**Solution:** Index the codebase first:
```javascript
{ "tool": "index_codebase" }
```

---

## 💡 Pro Tips

1. **Always index first** - Run `index_codebase` before semantic search
2. **Use context** - Enable `includeContext` for better chat responses
3. **Chain tools** - Combine multiple tools for powerful workflows
4. **Review before applying** - Use `preview: true` for refactoring
5. **Conversational memory** - Chat tool remembers context across calls

---

## 📚 More Resources

- **Full Documentation:** See [AI-CAPABILITIES.md](./AI-CAPABILITIES.md)
- **Configuration:** See [config-manager.js](./config-manager.js)
- **Examples:** See [AI-CAPABILITIES.md](./AI-CAPABILITIES.md#usage-examples)

---

## 🆘 Support

Having issues? Check:
1. ChromaDB is running: `docker ps | grep chroma`
2. Nexa is running: `curl http://127.0.0.1:8080/v1/models`
3. Config file exists: `cat ~/.luna-nexa-rag-config.json`
4. Dependencies installed: `npm list langchain`

---

## 🚀 Next Steps

1. Index your codebase
2. Try AI code review on a file
3. Chat with your codebase
4. Generate documentation
5. Explore all 15+ AI tools!

**Enjoy your AI-powered development! 🎉**
