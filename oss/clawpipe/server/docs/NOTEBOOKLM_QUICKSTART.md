# NotebookLM Features - Quick Start Guide

**Status:** ✅ Production Ready
**Version:** 1.0.0

---

## 🚀 5-Minute Quick Start

### Step 1: Install Dependencies

```bash
# Install NotebookLM dependencies
pip install -r requirements-notebooklm.txt

# Or install specific packages
pip install PyMuPDF scikit-learn
```

### Step 2: Start the Gateway

```bash
# Set environment variables
export FINSAVVYAI_NOTEBOOKLM_ENABLED=true
export FINSAVVYAI_SOURCES_PATH=./sources
export FINSAVVYAI_NOTEBOOKS_PATH=./notebooks

# Start the API gateway
python -m src.api.gateway
```

The gateway will start on `http://localhost:8080`

### Step 3: Upload Your First Document

```bash
# Upload a PDF
curl -X POST http://localhost:8080/api/notebook/sources/upload \
  -F "file=@research_paper.pdf"

# Upload a text file
curl -X POST http://localhost:8080/api/notebook/sources/upload \
  -F "file=@notes.txt"

# Response:
# {
#   "source_id": "source_abc123",
#   "name": "research_paper.pdf",
#   "type": "pdf",
#   "chunks": 15,
#   "size": 45000
# }
```

### Step 4: Create a Notebook

```bash
# Create a notebook
curl -X POST http://localhost:8080/api/notebook/notebooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Research Project"
  }'

# Response:
# {
#   "id": "nb_20260306_120000",
#   "name": "Research Project",
#   "sections": 1,
#   "created_at": "2026-03-06T12:00:00"
# }
```

### Step 5: Query Your Documents

```bash
# Query with RAG (Retrieval-Augmented Generation)
curl -X POST http://localhost:8080/api/notebook/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the main findings?",
    "source_ids": ["source_abc123"]
  }'

# Response:
# {
#   "response": "Based on the document, the main findings are...",
#   "citations": [
#     {
#       "source_id": "source_abc123",
#       "source_name": "research_paper.pdf",
#       "chunk_index": 2
#     }
#   ],
#   "sources_used": 1,
#   "context_length": 2500
# }
```

---

## 📚 Complete Workflow Example

### Research Assistant Workflow

```bash
# 1. Upload multiple research papers
curl -X POST http://localhost:8080/api/notebook/sources/upload -F "file=@paper1.pdf"
curl -X POST http://localhost:8080/api/notebook/sources/upload -F "file=@paper2.pdf"
curl -X POST http://localhost:8080/api/notebook/sources/upload -F "file=@paper3.pdf"

# 2. List all sources
curl http://localhost:8080/api/notebook/sources

# 3. Create a notebook for your project
curl -X POST http://localhost:8080/api/notebook/notebooks \
  -H "Content-Type: application/json" \
  -d '{"name": "Literature Review"}'

# 4. Get the notebook ID from response and create sections
NB_ID="nb_20260306_120000"
curl -X POST http://localhost:8080/api/sections \
  -H "Content-Type: application/json" \
  -d "{\"notebook_id\": \"$NB_ID\", \"title\": \"Introduction\"}"

curl -X POST http://localhost:8080/api/sections \
  -H "Content-Type: application/json" \
  -d "{\"notebook_id\": \"$NB_ID\", \"title\": \"Methodology\"}"

# 5. Attach sources to sections
SECTION_ID="section_20260306_120001"
curl -X POST http://localhost:8080/api/attach_sources \
  -H "Content-Type: application/json" \
  -d "{
    \"notebook_id\": \"$NB_ID\",
    \"section_id\": \"$SECTION_ID\",
    \"source_ids\": [\"source_abc123\", \"source_def456\"]
  }"

# 6. Add your research question
curl -X POST http://localhost:8080/api/messages \
  -H "Content-Type: application/json" \
  -d "{
    \"notebook_id\": \"$NB_ID\",
    \"section_id\": \"$SECTION_ID\",
    \"role\": \"user\",
    \"content\": \"What are the key differences between the methodologies used in these papers?\"
  }"

# 7. Query across your sources
curl -X POST http://localhost:8080/api/notebook/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Compare the methodologies",
    "source_ids": ["source_abc123", "source_def456"]
  }'
```

---

## 🎯 Common Use Cases

### Use Case 1: Document Summarization

```bash
# Upload document
SOURCE_ID=$(curl -X POST http://localhost:8080/api/notebook/sources/upload \
  -F "file=@report.pdf" | jq -r '.source_id')

# Summarize it
curl -X POST http://localhost:8080/api/notebook/sources/$SOURCE_ID/summarize

# Response:
# {
#   "source_id": "source_abc123",
#   "summary": "This report discusses...",
#   "original_length": 15000,
#   "summary_length": 300
# }
```

### Use Case 2: Code Documentation

```bash
# Upload code files
curl -X POST http://localhost:8080/api/notebook/sources/upload -F "file=@main.py"
curl -X POST http://localhost:8080/api/notebook/sources/upload -F "file=@README.md"

# Query about your code
curl -X POST http://localhost:8080/api/notebook/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does the authentication work?",
    "source_ids": ["source_py123", "source_md456"]
  }'
```

### Use Case 3: Multi-Document Analysis

```bash
# Upload multiple related documents
for file in doc1.pdf doc2.pdf doc3.txt; do
  curl -X POST http://localhost:8080/api/notebook/sources/upload -F "file=@$file"
done

# Get all source IDs
SOURCES=$(curl http://localhost:8080/api/notebook/sources | jq -r '.sources[].id')

# Query across all documents
curl -X POST http://localhost:8080/api/notebook/query \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"What are the common themes across all documents?\",
    \"source_ids\": $SOURCES
  }"
```

---

## 🔧 Advanced Configuration

### Adjust Chunk Size

```bash
# Default: 1000 characters with 200 overlap
# Customize via environment variables:
export SOURCE_CHUNK_SIZE=2000
export SOURCE_CHUNK_OVERLAP=400

# Or re-chunk an existing source
curl -X POST http://localhost:8080/api/notebook/sources/source_abc123/chunk \
  -H "Content-Type: application/json" \
  -d '{
    "chunk_size": 2000,
    "overlap": 400
  }'
```

### Custom Context Length

```python
import requests

# When querying, specify max_context
response = requests.post(
    'http://localhost:8080/api/notebook/query',
    json={
        'query': 'Detailed analysis...',
        'source_ids': ['source_abc123'],
        'max_context': 20000  # Use up to 20K characters
    }
)
```

---

## 📊 API Endpoints Reference

### Source Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notebook/sources/upload` | POST | Upload a document |
| `/api/notebook/sources` | GET | List all sources |
| `/api/notebook/sources/{id}` | GET | Get source details |
| `/api/notebook/sources/{id}` | DELETE | Delete a source |
| `/api/notebook/sources/{id}/chunk` | POST | Re-chunk a source |
| `/api/notebook/sources/{id}/summarize` | POST | Summarize a source |

### Notebook Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notebook/notebooks` | GET | List all notebooks |
| `/api/notebook/notebooks` | POST | Create a notebook |
| `/api/notebook/notebooks/{id}` | GET | Get a notebook |
| `/api/notebook/notebooks/{id}` | DELETE | Delete a notebook |
| `/api/sections` | POST | Create a section |
| `/api/messages` | POST | Add a message |
| `/api/attach_sources` | POST | Attach sources to section |

### Query & RAG

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notebook/query` | POST | Query with RAG |

---

## 🐛 Troubleshooting

### Issue: PDF Upload Fails

```bash
# Ensure PyMuPDF is installed
pip install PyMuPDF

# Test PDF processing
python3 -c "import fitz; print('✅ PyMuPDF works')"
```

### Issue: No Relevant Chunks Found

```bash
# Check chunk count
curl http://localhost:8080/api/notebook/sources/source_id | jq '.chunks'

# Try increasing chunk_size or re-chunking
curl -X POST http://localhost:8080/api/notebook/sources/source_id/chunk \
  -H "Content-Type: application/json" \
  -d '{"chunk_size": 500, "overlap": 100}'
```

### Issue: Gateway Won't Start

```bash
# Check if routes are properly registered
python3 -c "from src.api.gateway import APIGateway; print('✅ Gateway imports OK')"

# Check if NotebookLM features are enabled
env | grep FINSAVVYAI_NOTEBOOKLM
```

---

## 📖 Next Steps

1. **Explore the API**: Try different queries and document types
2. **Build UI Components**: Create React components for LM Studio extension
3. **Add Voice Interface**: Implement Web Speech API integration
4. **Custom Instructions**: Create domain-specific system prompts
5. **Multi-Model Support**: Query with different LM Studio models

---

## 🚀 Production Deployment

```bash
# Using Docker Compose
docker-compose up -d

# Check health
curl http://localhost:8080/health?verbose=true

# View metrics
curl http://localhost:8080/metrics
```

---

**For full documentation**, see [NOTEBOOKLM_COMPLETE.md](./NOTEBOOKLM_COMPLETE.md)

**For integration with LM Studio**, see [LM_STUDIO_IMPLEMENTATION_GUIDE.md](./LM_STUDIO_IMPLEMENTATION_GUIDE.md)
