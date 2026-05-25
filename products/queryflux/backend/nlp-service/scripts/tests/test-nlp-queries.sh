#!/bin/bash
# Test script for natural language queries with QueryLens

# Set the base URL
BASE_URL="http://localhost:8082"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing QueryLens Natural Language Query API${NC}"
echo "================================================="

# Test 1: Get available datasources
echo -e "\n${YELLOW}Test 1: Getting all datasources${NC}"
echo "GET $BASE_URL/api/datasources"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/datasources" -H "Content-Type: application/json")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Extract the first datasource ID
DATASOURCE_ID=$(echo $RESPONSE | jq '.[0].id' 2>/dev/null || echo 1)
echo -e "\n${YELLOW}Using datasource ID: $DATASOURCE_ID${NC}"

# Test 2: Create a mock NLP query with aggregation intent
echo -e "\n${YELLOW}Test 2: Aggregation Query - Count all records${NC}"
echo "POST $BASE_URL/api/query/execute"
QUERY_PAYLOAD='{
  "text": "Count all records", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
echo "Payload: $QUERY_PAYLOAD"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$QUERY_PAYLOAD")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 3: Create a mock NLP query with filtering intent
echo -e "\n${YELLOW}Test 3: Filtering Query - Find specific records${NC}"
echo "POST $BASE_URL/api/query/execute"
QUERY_PAYLOAD='{
  "text": "Show records where id = 1", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
echo "Payload: $QUERY_PAYLOAD"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$QUERY_PAYLOAD")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 4: Create a mock NLP query with comparison intent
echo -e "\n${YELLOW}Test 4: Comparison Query - Compare by category${NC}"
echo "POST $BASE_URL/api/query/execute"
QUERY_PAYLOAD='{
  "text": "Compare counts by category", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
echo "Payload: $QUERY_PAYLOAD"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$QUERY_PAYLOAD")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 5: Create a mock NLP query with trending intent
echo -e "\n${YELLOW}Test 5: Trending Query - Show trend over time${NC}"
echo "POST $BASE_URL/api/query/execute"
QUERY_PAYLOAD='{
  "text": "Show trend over time", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
echo "Payload: $QUERY_PAYLOAD"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$QUERY_PAYLOAD")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Bonus: Use the test controller for raw SQL
echo -e "\n${YELLOW}Bonus: Direct SQL query - Table schema${NC}"
echo "POST $BASE_URL/api/test/query/$DATASOURCE_ID"
QUERY="SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC'"
echo "Query: $QUERY"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  -d "$QUERY")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

echo -e "\n${YELLOW}All tests completed!${NC}"
