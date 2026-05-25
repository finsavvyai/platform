#!/bin/bash

echo "Starting Questro Backend Production Server..."

# Run database migrations if enabled
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npx drizzle-kit migrate || echo "Migration failed, continuing anyway..."
fi

# Start the production server
echo "Starting Node.js server..."
node dist/index.js