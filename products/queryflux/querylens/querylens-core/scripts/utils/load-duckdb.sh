#!/bin/bash

# Load init SQL into DuckDB
java -cp "./target/dependency/*" org.duckdb.DuckDBCLI -c "ATTACH querylens AS querylens; USE querylens;" < src/main/resources/db/duckdb/init.sql

echo "DuckDB database initialized."
