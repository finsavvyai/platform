#!/bin/bash
# Advanced test script for QueryLens SQL parsing improvements

# Set the base URL
BASE_URL="http://localhost:8082"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}QueryLens Advanced SQL Test${NC}"
echo "================================================="

# Get datasource information
echo -e "\n${YELLOW}Getting datasource information${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/datasources" -H "Content-Type: application/json")
DATASOURCE_ID=$(echo $RESPONSE | jq '.[0].id' 2>/dev/null || echo 1)
echo -e "${GREEN}Using datasource ID: $DATASOURCE_ID${NC}"

# Test 1: Simple SELECT query
echo -e "\n${YELLOW}Test 1: Simple SELECT query${NC}"
QUERY="SELECT * FROM DATASOURCES"
echo -e "${GREEN}Query: $QUERY${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.sql, .success' 2>/dev/null || echo $RESPONSE

# Test 2: Complex SELECT query with multiple columns
echo -e "\n${YELLOW}Test 2: Complex SELECT query with multiple columns${NC}"
QUERY="SELECT ID, NAME, URL FROM DATASOURCES WHERE ID = 1"
echo -e "${GREEN}Query: $QUERY${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.sql, .success' 2>/dev/null || echo $RESPONSE

# Test 3: Query with COUNT function
echo -e "\n${YELLOW}Test 3: Query with COUNT function${NC}"
QUERY="SELECT COUNT(*) AS total_count FROM DATASOURCES"
echo -e "${GREEN}Query: $QUERY${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.sql, .results' 2>/dev/null || echo $RESPONSE

# Test 4: CREATE TABLE statement
echo -e "\n${YELLOW}Test 4: CREATE TABLE statement${NC}"
QUERY="CREATE TABLE IF NOT EXISTS test_table (id INT PRIMARY KEY, name VARCHAR(50))"
echo -e "${GREEN}Query: $QUERY${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.sql, .success' 2>/dev/null || echo $RESPONSE

# Test 5: INSERT statement
echo -e "\n${YELLOW}Test 5: INSERT statement${NC}"
QUERY="INSERT INTO test_table VALUES (1, 'Test Data')"
echo -e "${GREEN}Query: $QUERY${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.sql, .success' 2>/dev/null || echo $RESPONSE

# Test 6: Verify inserted data
echo -e "\n${YELLOW}Test 6: Verify inserted data${NC}"
QUERY="SELECT * FROM test_table"
echo -e "${GREEN}Query: $QUERY${NC}"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.sql, .results' 2>/dev/null || echo $RESPONSE

echo -e "\n${YELLOW}All SQL tests completed successfully!${NC}"
