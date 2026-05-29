#!/bin/bash

# Create DB directory
mkdir -p db

# Simple message
echo "Building application with DuckDB..."

# Build the application
mvn clean package -DskipTests

echo "Done building. Looking for JAR..."
ls -la target/*.jar
