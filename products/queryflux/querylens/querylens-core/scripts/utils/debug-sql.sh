#!/bin/bash
# Debug script to verify SQL cleaning in QueryLens

# Set the base URL
BASE_URL="http://localhost:8082"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}QueryLens SQL Cleaning Debug Test${NC}"
echo "================================================="

# Get datasource information
echo -e "\n${YELLOW}Getting datasource information${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/datasources" -H "Content-Type: application/json")
DATASOURCE_ID=$(echo $RESPONSE | jq '.[0].id' 2>/dev/null || echo 1)
echo -e "${GREEN}Using datasource ID: $DATASOURCE_ID${NC}"

# Test 1: Simple SELECT * query
echo -e "\n${YELLOW}Test 1: Simple SELECT * query${NC}"
QUERY="SELECT * FROM DATASOURCES"
echo -e "${GREEN}Query: $QUERY${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")

echo -e "${GREEN}Original SQL:${NC}"
echo $RESPONSE | jq '.originalSql' 2>/dev/null || echo $RESPONSE

echo -e "${GREEN}Executed SQL:${NC}"
echo $RESPONSE | jq '.executedSql' 2>/dev/null || echo $RESPONSE

echo -e "${GREEN}Success:${NC}"
echo $RESPONSE | jq '.success' 2>/dev/null || echo $RESPONSE

echo -e "${GREEN}Results:${NC}"
echo $RESPONSE | jq '.results' 2>/dev/null || echo $RESPONSE

# Test 2: Complex query with columns 
echo -e "\n${YELLOW}Test 2: Complex query with columns${NC}"
QUERY="SELECT ID, NAME, URL FROM DATASOURCES WHERE ID = 1"
echo -e "${GREEN}Query: $QUERY${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")

echo -e "${GREEN}Original SQL:${NC}"
echo $RESPONSE | jq '.originalSql' 2>/dev/null || echo $RESPONSE

echo -e "${GREEN}Executed SQL:${NC}"
echo $RESPONSE | jq '.executedSql' 2>/dev/null || echo $RESPONSE

echo -e "${GREEN}Success:${NC}"
echo $RESPONSE | jq '.success' 2>/dev/null || echo $RESPONSE

# Test 3: CREATE TABLE query
echo -e "\n${YELLOW}Test 3: CREATE TABLE query${NC}"
QUERY="CREATE TABLE IF NOT EXISTS test_table (id INT PRIMARY KEY, name VARCHAR(50))"
echo -e "${GREEN}Query: $QUERY${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")

echo -e "${GREEN}Original SQL:${NC}"
echo $RESPONSE | jq '.originalSql' 2>/dev/null || echo $RESPONSE

echo -e "${GREEN}Executed SQL:${NC}"
echo $RESPONSE | jq '.executedSql' 2>/dev/null || echo $RESPONSE

echo -e "${GREEN}Success:${NC}"
echo $RESPONSE | jq '.success' 2>/dev/null || echo $RESPONSE
