# ML Anomaly Detector Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PATH="/app/.venv/bin:$PATH"
ENV CUDA_VISIBLE_DEVICES=""  # Force CPU usage for inference

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Create virtual environment
RUN python -m venv /app/.venv

# Install Python dependencies
COPY requirements-ml.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-ml.txt

# Copy application code
COPY ml-anomaly-detection.py .
COPY requirements-ml.txt .

# Create non-root user
RUN useradd -m -u 1000 anomaly && \
    chown -R anomaly:anomaly /app
USER anomaly

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose ports
EXPOSE 8000 8001

# Run the application
CMD ["python", "-m", "uvicorn", "ml_anomaly_detection:app", "--host", "0.0.0.0", "--port", "8000"]