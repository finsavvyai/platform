# 🤖 Luna RAG - AI Capabilities

## Overview

Luna RAG now includes **15+ AI-powered tools** beyond basic RAG, leveraging **LangChain** for advanced code analysis, documentation, and natural language processing.

## 🚀 Core Technologies

- **LangChain** - Advanced AI chains and agents
- **ChromaDB** - Vector database for semantic search
- **Nexa Embeddings** - High-quality local embeddings
- **OpenAI-Compatible API** - Works with any OpenAI-compatible backend

---

## 📋 Available AI Tools

### 1. 🔍 Code Analysis & Review

#### **ai_code_review**
AI-powered code review with comprehensive feedback.

**Features:**
- Security vulnerability detection
- Performance optimization suggestions
- Code style and best practices
- Specific code improvement recommendations

**Usage:**
```json
{
  "filePath": "./src/components/UserAuth.js",
  "reviewType": "security" // "full", "security", "performance", "style"
}
```

---

#### **ai_explain_code**
Detailed code explanation with documentation.

**Features:**
- High-level overview
- Component breakdown
- Pattern recognition
- Beginner-friendly explanations

**Usage:**
```json
{
  "code": "const fetchData = async () => {...}",
  "detailLevel": "beginner" // "summary", "detailed", "beginner"
}
```

---

#### **ai_detect_bugs**
Automated bug and vulnerability detection.

**Features:**
- Logic error detection
- Security vulnerabilities
- Memory leaks
- Race conditions
- Error handling gaps

**Usage:**
```json
{
  "filePath": "./src/api/handlers.js",
  "severityLevel": "high" // "all", "critical", "high", "medium"
}
```

---

#### **ai_refactor_code**
Modern code refactoring with best practices.

**Features:**
- Performance optimization
- Readability improvements
- Modern JS/TS patterns
- DRY principle application

**Usage:**
```json
{
  "filePath": "./src/legacy/oldModule.js",
  "refactorType": "modernize" // "performance", "readability", "modernize", "dry"
}
```

---

### 2. 🧪 Testing & Quality

#### **ai_generate_tests**
Comprehensive test generation for any framework.

**Features:**
- Unit test generation
- Edge case coverage
- Mock data creation
- Framework-specific best practices

**Supported Frameworks:**
- Jest
- Vitest
- Mocha
- Playwright

**Usage:**
```json
{
  "filePath": "./src/utils/dataProcessor.js",
  "testFramework": "jest",
  "coverage": "comprehensive" // "basic", "comprehensive", "edge-cases"
}
```

---

### 3. 📚 Documentation Generation

#### **ai_generate_documentation**
Auto-generate professional documentation.

**Features:**
- JSDoc/TSDoc comments
- Markdown README files
- API reference
- Usage examples
- Dependency documentation

**Usage:**
```json
{
  "filePath": "./src/lib/calculator.js",
  "format": "markdown", // "jsdoc", "tsdoc", "markdown", "readme"
  "includeExamples": true
}
```

---

#### **ai_generate_pr_description**
GitHub PR descriptions from git diff.

**Features:**
- Conventional commit style
- Change summary
- Testing checklist
- Breaking changes detection

**Usage:**
```json
{
  "branch": "feature/new-auth",
  "baseBranch": "main"
}
```

---

#### **ai_generate_commit_message**
Conventional commit messages.

**Features:**
- Follows conventional commits
- Semantic versioning compatible
- Detailed body and footer

**Usage:**
```json
{
  "staged": true
}
```

---

### 4. 💬 Conversational AI

#### **ai_chat_with_codebase**
Chat with your codebase using RAG + memory.

**Features:**
- Conversational memory
- Context-aware responses
- Code snippet retrieval
- Multi-turn conversations

**Usage:**
```json
{
  "question": "How does authentication work in this app?",
  "includeContext": true
}
```

---

### 5. 📊 Codebase Analysis

#### **ai_summarize_codebase**
Comprehensive codebase summary and architecture analysis.

**Features:**
- Project overview
- Architecture patterns
- Tech stack analysis
- Component relationships

**Usage:**
```json
{
  "scope": "full", // "full", "backend", "frontend", "directory-name"
  "detailLevel": "overview" // "overview", "detailed", "technical"
}
```

---

#### **ai_analyze_dependencies**
Dependency analysis with security audit.

**Features:**
- Security vulnerability scan
- Update recommendations
- Bundle size impact
- Alternative package suggestions

**Usage:**
```json
{
  "checkSecurity": true,
  "suggestUpdates": true
}
```

---

#### **ai_tech_debt_analysis**
Technical debt detection and prioritization.

**Features:**
- Code smell detection
- Anti-pattern identification
- Missing test detection
- Prioritized recommendations

**Usage:**
```json
{
  "scope": "full"
}
```

---

#### **ai_architecture_recommendations**
Architecture improvement suggestions.

**Features:**
- Scalability analysis
- Maintainability improvements
- Performance optimizations
- Security hardening

**Usage:**
```json
{
  "focus": "scalability" // "scalability", "maintainability", "performance", "security", "all"
}
```

---

### 6. 🧠 Natural Language Processing

#### **ai_sentiment_analysis**
Sentiment analysis for text, comments, and reviews.

**Features:**
- Positive/negative/neutral classification
- Confidence scores
- Key phrase extraction
- Improvement suggestions

**Usage:**
```json
{
  "text": "This feature is absolutely amazing!",
  "filePath": "./reviews.txt" // Optional
}
```

---

#### **ai_extract_entities**
Named entity extraction (NER).

**Features:**
- Person names
- Organizations
- Locations
- Technologies
- Custom entity types

**Usage:**
```json
{
  "text": "John from Microsoft built this using React and Next.js",
  "entityTypes": ["person", "organization", "technology"]
}
```

---

## 🔧 Setup & Configuration

### 1. Install Dependencies

```bash
cd mcp-servers/luna-nexa-rag
npm install
```

### 2. Configure Nexa Backend

Start Nexa server for embeddings and LLM:

```bash
nexa server start
```

Or use Docker:

```bash
docker run -d -p 8080:8080 nexaai/nexa
```

### 3. Start ChromaDB

```bash
docker run -d -p 8000:8000 chromadb/chroma
```

### 4. Configure MCP Server

Edit `~/.luna-nexa-rag-config.json`:

```json
{
  "projectPath": "/path/to/your/project",
  "collectionName": "my-project-rag",
  "chromaHost": "localhost",
  "chromaPort": 8000,
  "useNexaEmbeddings": true,
  "nexaEndpoint": "http://127.0.0.1:8080",
  "fileTypes": [".js", ".ts", ".tsx", ".jsx", ".py", ".md"]
}
```

---

## 🎯 Usage Examples

### Example 1: AI Code Review

```javascript
// Call through MCP
{
  "tool": "ai_code_review",
  "arguments": {
    "filePath": "./src/components/AuthForm.jsx",
    "reviewType": "security"
  }
}

// Output:
// 🔍 AI Code Review Results:
// 
// Overall Assessment: ⚠️ Security concerns detected
// 
// Issues Found:
// 1. [CRITICAL] Password stored in plain text (line 45)
//    - Recommendation: Use bcrypt for password hashing
//    - Code: const hashedPassword = await bcrypt.hash(password, 10);
//
// 2. [HIGH] Missing input validation (line 23)
//    - Recommendation: Add Zod schema validation
//    - Code: const schema = z.object({ email: z.string().email() });
```

---

### Example 2: Conversational Codebase Chat

```javascript
// Question 1
{
  "tool": "ai_chat_with_codebase",
  "arguments": {
    "question": "How does the authentication flow work?",
    "includeContext": true
  }
}

// Question 2 (with memory)
{
  "tool": "ai_chat_with_codebase",
  "arguments": {
    "question": "Can you show me an example of using it?",
    "includeContext": true
  }
}
// The AI remembers the previous conversation about authentication!
```

---

### Example 3: Generate Tests

```javascript
{
  "tool": "ai_generate_tests",
  "arguments": {
    "filePath": "./src/utils/dateFormatter.js",
    "testFramework": "jest",
    "coverage": "comprehensive"
  }
}

// Output: Complete test file with:
// - Setup and imports
// - Unit tests for all functions
// - Edge cases
// - Mock data
// Ready to save and run!
```

---

## 🌟 Advanced Features

### LangChain Integration

All AI tools use LangChain for:
- **Prompt Templates** - Consistent, high-quality prompts
- **Chains** - Multi-step AI workflows
- **Memory** - Conversation history
- **Agents** - Autonomous task execution (coming soon)

### RAG + LLM Combination

Many tools combine:
1. **RAG** (Retrieval Augmented Generation) - Semantic code search
2. **LLM** (Large Language Model) - AI analysis and generation
3. **Memory** - Context retention across calls

This provides more accurate, context-aware results!

---

## 🎨 Integration with Luna Agents

Works seamlessly with other Luna tools:

```bash
# 1. Index codebase
luna-nexa-rag index_codebase

# 2. AI code review
luna-nexa-rag ai_code_review --filePath ./src/App.js

# 3. Generate tests
luna-nexa-rag ai_generate_tests --filePath ./src/App.js

# 4. Chat with codebase
luna-nexa-rag ai_chat_with_codebase --question "Explain the routing"
```

---

## 📈 Performance

- **Nexa Embeddings**: Local, fast, high-quality
- **ChromaDB**: Millisecond semantic search
- **LangChain**: Optimized prompt engineering
- **Batch Processing**: Handle large codebases efficiently

---

## 🔐 Privacy & Security

- **Local-first**: All processing can run locally
- **No external API calls** (when using Nexa)
- **Your code stays private**
- OpenAI-compatible for flexibility

---

## 🚀 Coming Soon

- **AI Agent Workflows** - Autonomous task execution
- **Multi-modal Analysis** - Screenshots and diagrams
- **Custom RAG Chains** - Domain-specific retrieval
- **Tool Calling** - AI agents that use your tools
- **Vector Store Options** - Pinecone, Weaviate, Milvus

---

## 🤝 Contributing

Want to add more AI capabilities? PRs welcome!

1. Add tool definition in `index.js`
2. Implement AI method with LangChain
3. Update this documentation
4. Test with Nexa backend

---

## 📝 License

MIT - Shachar Solomon

---

## 💡 Tips

1. **Index First**: Always run `index_codebase` before using RAG features
2. **Use Context**: Enable `includeContext` for better chat responses
3. **Combine Tools**: Chain multiple tools for powerful workflows
4. **Tune Prompts**: Modify prompts for your specific needs
5. **Monitor Performance**: Check console logs for timing info

---

Enjoy your AI-powered development experience! 🚀
