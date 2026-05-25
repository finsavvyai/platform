#!/bin/bash

echo "🗄️  Starting ChromaDB..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo ""
    echo "Please start Docker Desktop and try again."
    echo ""
    exit 1
fi

# Check if ChromaDB container already exists
if docker ps -a | grep -q luna-chroma; then
    echo "Found existing ChromaDB container..."
    docker start luna-chroma
    echo "✅ ChromaDB container started"
else
    echo "Creating new ChromaDB container..."
    docker run -d \
        --name luna-chroma \
        -p 8000:8000 \
        -v $(pwd)/chroma-data:/chroma/chroma \
        chromadb/chroma:latest
    echo "✅ ChromaDB container created and started"
fi

echo ""
echo "ChromaDB is now running at http://localhost:8000"
echo ""
echo "To stop: docker stop luna-chroma"
echo "To view logs: docker logs luna-chroma"
echo ""
