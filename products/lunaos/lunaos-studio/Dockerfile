# LunaOS Orchestrator GUI Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy application files
COPY . .

# Create non-root user
RUN useradd -m -u 1000 lunaos && chown -R lunaos:lunaos /app
USER lunaos

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Start the GUI server
CMD ["python3", "server.py", "--port", "8000", "--no-browser"]
