#!/bin/bash

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Please start Docker and try again."
  exit 1
fi

# Check if container is already running
if docker ps -a | grep -q "querylens-postgres"; then
  echo "A container named querylens-postgres already exists."
  echo "Do you want to remove it and create a new one? (y/n)"
  read response
  if [ "$response" == "y" ]; then
    docker stop querylens-postgres > /dev/null 2>&1
    docker rm querylens-postgres > /dev/null 2>&1
    echo "Removed existing container."
  else
    echo "Setup aborted."
    exit 0
  fi
fi

# Pull the latest PostgreSQL image
echo "Pulling PostgreSQL 14 image..."
docker pull postgres:14

# Run the PostgreSQL container
echo "Starting PostgreSQL container..."
docker run -d \
  --name querylens-postgres \
  -e POSTGRES_DB=querylens \
  -e POSTGRES_USER=querylens \
  -e POSTGRES_PASSWORD=querylens \
  -p 5432:5432 \
  postgres:14

# Check if container started successfully
if [ $? -eq 0 ]; then
  echo "PostgreSQL container started successfully."
  echo ""
  echo "Connection details:"
  echo "  JDBC URL: jdbc:postgresql://localhost:5432/querylens"
  echo "  Username: querylens"
  echo "  Password: querylens"
  echo ""
  echo "Wait a few seconds for PostgreSQL to initialize..."
  sleep 5

  # Create a temp SQL file with initialization script
  cat > init_temp.sql << EOF
-- Create schema and tables if not exists
CREATE SCHEMA IF NOT EXISTS querylens;

-- Create tables for the application
CREATE TABLE IF NOT EXISTS datasources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  connection_string TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queries (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  datasource_id INTEGER REFERENCES datasources(id),
  sql_query TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add some initial data if needed
INSERT INTO datasources (name, connection_string)
VALUES ('Sample Database', 'jdbc:postgresql://localhost:5432/querylens')
ON CONFLICT DO NOTHING;
EOF

  # Initialize the database
  echo "Initializing database schema..."
  docker exec -i querylens-postgres psql -U querylens -d querylens < init_temp.sql

  # Remove the temp SQL file
  rm init_temp.sql

  echo ""
  echo "Database initialization complete!"
  echo "You can now start your QueryLens application."
else
  echo "Failed to start PostgreSQL container. Please check Docker logs."
  exit 1
fi