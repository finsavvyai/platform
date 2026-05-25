#!/bin/bash

echo "Building BSL Monitor Dashboard..."

# Build frontend
echo "Building React frontend..."
cd frontend
npm install
npm run build

# Copy built files to Spring Boot static resources
echo "Copying frontend build to Spring Boot resources..."
cd ..
rm -rf src/main/resources/static/*
cp -r frontend/build/* src/main/resources/static/

# Build Spring Boot application
echo "Building Spring Boot application..."
./gradlew clean bootJar

echo "Build completed successfully!"
echo "Built JAR: build/libs/monitor-1.0.0-SNAPSHOT.jar"