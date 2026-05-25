#!/bin/sh
set -e

echo "=== Qestro Production Server ==="
echo "Environment: ${NODE_ENV:-production}"
echo "Port: ${PORT:-8000}"
echo "Node: $(node --version)"

# Run database migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  cd /app/backend
  node dist/index.js --migrate 2>/dev/null || echo "Migration flag not supported, skipping."
  cd /app
fi

# Start the backend server
echo "Starting Qestro API server..."
cd /app/backend
exec node dist/index.js
