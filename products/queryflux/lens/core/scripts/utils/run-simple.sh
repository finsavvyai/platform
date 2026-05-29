#!/bin/bash

# Create DB directory
mkdir -p db

# Build the application
echo "Building application..."
mvn clean package -DskipTests

# Run the application
echo "Running application..."
java -jar target/querylens-core-0.1.0-SNAPSHOT.jar
