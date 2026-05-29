#!/bin/bash

# Build the application
mvn clean package -DskipTests

# Copy dependencies
mvn dependency:copy-dependencies

# Initialize DuckDB (if needed)
./load-duckdb.sh

# Run with DuckDB profile
java -jar target/*.jar --spring.profiles.active=duckdb
