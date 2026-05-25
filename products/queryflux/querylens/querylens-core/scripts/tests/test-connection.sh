#!/bin/bash
# Test script for database connection and direct SQL queries

# Set the base URL
BASE_URL="http://localhost:8082"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing QueryLens Database Connections${NC}"
echo "================================================="

# Test 1: Get all datasources
echo -e "\n${YELLOW}Test 1: Getting all datasources${NC}"
echo "GET $BASE_URL/api/datasources"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/datasources" -H "Content-Type: application/json")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Extract the first datasource ID
DATASOURCE_ID=$(echo $RESPONSE | jq '.[0].id' 2>/dev/null || echo 1)
echo -e "\n${YELLOW}Using datasource ID: $DATASOURCE_ID${NC}"

# Test 2: Test connection
echo -e "\n${YELLOW}Test 2: Test connection to datasource${NC}"
echo "GET $BASE_URL/api/test/connection/$DATASOURCE_ID"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/test/connection/$DATASOURCE_ID" -H "Content-Type: application/json")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 3: Direct SQL Query via Test Controller
echo -e "\n${YELLOW}Test 3: Execute SQL via Test Controller${NC}"
echo "POST $BASE_URL/api/test/query/$DATASOURCE_ID"
QUERY="SELECT 1 as test"
echo "Query: $QUERY"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  -d "$QUERY")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 4: Get database schema information
echo -e "\n${YELLOW}Test 4: Get database schema${NC}"
echo "POST $BASE_URL/api/test/query/$DATASOURCE_ID"
QUERY="SHOW TABLES"
echo "Query: $QUERY"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  -d "$QUERY")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

echo -e "\n${YELLOW}All tests completed!${NC}"
