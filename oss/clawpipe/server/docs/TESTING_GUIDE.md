# FinSavvyAI × LM Studio - Complete Testing Guide

**Status:** ✅ Deployed and Running
**Gateway:** http://localhost:8080
**LM Studio:** http://localhost:1234

---

## 🚀 Quick Test (One Command)

```bash
bash /tmp/quick_tests.sh
```

This will run all 5 core tests automatically.

---

## 📋 Manual Tests

### Test 1: Health Check

Verify the gateway is running:

```bash
curl http://localhost:8080/health | jq
```

**Expected output:**
```json
{
  "status": "healthy",
  "gateway": "online",
  "cloud_providers": {
    "lmstudio": true
  }
}
```

---

### Test 2: Upload a Document

Upload a text document:

```bash
curl -X POST http://localhost:8080/api/notebook/sources/import \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "my_document.txt",
    "file_type": "text",
    "content": "This is my document. It has multiple sentences. The system will chunk it automatically."
  }' | jq
```

**Expected output:**
```json
{
  "source_id": "source_abc123",
  "name": "my_document.txt",
  "chunks": 1,
  "size": 123
}
```

**Save the source_id for later tests!**

---

### Test 3: List All Sources

See all uploaded documents:

```bash
curl http://localhost:8080/api/notebook/sources | jq
```

**Expected output:**
```json
{
  "sources": [
    {
      "id": "source_abc123",
      "name": "my_document.txt",
      "type": "text",
      "chunks": 1,
      "size": 123
    }
  ]
}
```

---

### Test 4: Create a Notebook

Create a notebook for organizing your research:

```bash
curl -X POST http://localhost:8080/api/notebook/notebooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Research Project"
  }' | jq
```

**Expected output:**
```json
{
  "id": "nb_20260306_120000",
  "name": "My Research Project",
  "sections": 1
}
```

**Save the notebook_id for later tests!**

---

### Test 5: Get Notebook Details

View notebook structure:

```bash
curl http://localhost:8080/api/notebook/notebooks/nb_20260306_120000 | jq
```

---

### Test 6: LM Studio Direct Chat

Test LM Studio directly:

```bash
curl -X POST http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemma-3-4b",
    "messages": [
      {"role": "user", "content": "What is quantum computing? One sentence."}
    ],
    "max_tokens": 50
  }' | jq
```

---

## 🎯 Real-World Test Scenarios

### Scenario 1: Research Paper Analysis

```bash
# 1. Upload a research paper
curl -X POST http://localhost:8080/api/notebook/sources/import \
  -H "Content-Type: application/json" \
  -d "{
    \"filename\": \"paper.txt\",
    \"file_type\": \"text\",
    \"content\": \"$(cat my_paper.txt | sed 's/"/\\"/g' | tr '\n' ' ')\"
  }"

# 2. Create a notebook
curl -X POST http://localhost:8080/api/notebook/notebooks \
  -H "Content-Type: application/json" \
  -d '{"name": "Paper Analysis"}'

# 3. List sources to get IDs
curl http://localhost:8080/api/notebook/sources | jq
```

---

### Scenario 2: Code Documentation

```bash
# Upload code files
curl -X POST http://localhost:8080/api/notebook/sources/import \
  -H "Content-Type: application/json" \
  -d "{
    \"filename\": \"main.py\",
    \"file_type\": \"text\",
    \"content\": \"$(cat main.py | sed 's/"/\\"/g' | tr '\n' ' ')\"
  }"

curl -X POST http://localhost:8080/api/notebook/sources/import \
  -H "Content-Type: application/json" \
  -d "{
    \"filename\": \"README.md\",
    \"file_type\": \"text\",
    \"content\": \"$(cat README.md | sed 's/"/\\"/g' | tr '\n' ' ')\"
  }"

# Create documentation notebook
curl -X POST http://localhost:8080/api/notebook/notebooks \
  -H "Content-Type: application/json" \
  -d '{"name": "Code Documentation"}'
```

---

### Scenario 3: Multi-Document Project

```bash
# Upload multiple related documents
for file in doc1.txt doc2.txt doc3.txt; do
  curl -X POST http://localhost:8080/api/notebook/sources/import \
    -H "Content-Type: application/json" \
    -d "{
      \"filename\": \"$file\",
      \"file_type\": \"text\",
      \"content\": \"$(cat $file | sed 's/"/\\"/g' | tr '\n' ' ')\"
    }"
done

# Create project notebook
curl -X POST http://localhost:8080/api/notebook/notebooks \
  -H "Content-Type: application/json" \
  -d '{"name": "Project Documentation"}'

# List all sources
curl http://localhost:8080/api/notebook/sources | jq '.sources[].name'
```

---

## 🧪 Testing with Python

Create a test script `test_notebooklm.py`:

```python
import asyncio
import httpx
import json

async def test_workflow():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Health check
        resp = await client.get("http://localhost:8080/health")
        print(f"Health: {resp.json()['status']}")

        # 2. Upload document
        with open("my_document.txt", "r") as f:
            content = f.read()

        resp = await client.post(
            "http://localhost:8080/api/notebook/sources/import",
            json={
                "filename": "doc.txt",
                "file_type": "text",
                "content": content
            }
        )
        source_id = resp.json()["source_id"]
        print(f"Uploaded: {source_id}")

        # 3. List sources
        resp = await client.get("http://localhost:8080/api/notebook/sources")
        sources = resp.json()["sources"]
        print(f"Total sources: {len(sources)}")

        # 4. Create notebook
        resp = await client.post(
            "http://localhost:8080/api/notebook/notebooks",
            json={"name": "Test Notebook"}
        )
        notebook_id = resp.json()["id"]
        print(f"Notebook: {notebook_id}")

asyncio.run(test_workflow())
```

Run it:
```bash
python3 test_notebooklm.py
```

---

## 🐛 Troubleshooting

### Issue: Gateway not responding

```bash
# Check if gateway is running
ps aux | grep "src.api.gateway"

# Restart gateway
lsof -ti :8080 | xargs kill -9
export FINSAVVYAI_NOTEBOOKLM_ENABLED=true
python3 -m src.api.gateway &
```

### Issue: LM Studio not connected

```bash
# Check LM Studio
curl http://localhost:1234/v1/models | jq

# Make sure LM Studio app is open
# Click the 💬 icon to enable the server
```

### Issue: Upload fails

```bash
# Use the JSON endpoint instead of multipart
curl -X POST http://localhost:8080/api/notebook/sources/import \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.txt", "file_type": "text", "content": "test"}'
```

---

## 📊 Testing Checklist

- [ ] Gateway health check passes
- [ ] Can upload documents via JSON endpoint
- [ ] Can list all sources
- [ ] Can create notebooks
- [ ] Can retrieve notebook details
- [ ] LM Studio responds to chat completions
- [ ] Multiple sources can be uploaded
- [ ] Data persists in ./sources and ./notebooks

---

## 🎉 Success Criteria

You're all set if:

✅ Gateway responds to health checks
✅ Documents upload and are chunked
✅ Sources are catalogued and retrievable
✅ Notebooks can be created and managed
✅ LM Studio responds to queries
✅ Data persists across restarts

---

**Happy testing! Your local LLM platform is ready! 🚀**
