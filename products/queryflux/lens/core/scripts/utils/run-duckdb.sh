#!/bin/bash

# Create DB directory
mkdir -p db

# Build the application
echo "Building application with DuckDB..."
mvn clean package -DskipTests

# Find the JAR file
JAR_FILE=$(find target/ -name "*.jar" | head -n 1)

if [ -z "$JAR_FILE" ]; then
  echo "Build failed or JAR file not found."
  echo "Looking in target directory:"
  ls -la target/
  exit 1
fi

echo "Starting application with DuckDB profile..."
echo "JAR file: $JAR_FILE"
java -jar $JAR_FILE --spring.profiles.active=duckdb
