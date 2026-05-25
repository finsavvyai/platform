#!/bin/bash

echo "🌙 Setting up Luna RAG for Claude Code..."

# Start ChromaDB if not running
if ! docker ps | grep -q chroma; then
    echo "📦 Starting ChromaDB..."
    docker run -d --name luna-chroma -p 8000:8000 chromadb/chroma
    echo "✅ ChromaDB started on port 8000"
else
    echo "✅ ChromaDB already running"
fi

# Wait for ChromaDB to be ready
echo "⏳ Waiting for ChromaDB to be ready..."
sleep 5

# Test ChromaDB connection
if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null; then
    echo "✅ ChromaDB is ready"
else
    echo "❌ ChromaDB connection failed"
    exit 1
fi

echo "🚀 Luna RAG is ready!"
echo ""
echo "📚 Usage in Claude Code:"
echo "   'Index the current codebase for semantic search'"
echo "   'Search for authentication patterns in the code'"
echo "   'Find similar implementations to user management'"
echo "   'What are the error handling patterns in this project?'"
echo ""
echo "🔄 Restart Claude Desktop to activate RAG integration"