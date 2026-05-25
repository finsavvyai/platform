#!/bin/bash
# Direct test script for QueryService that bypasses NLP analysis

# Set the base URL
BASE_URL="http://localhost:8081"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing QueryLens Service - Direct SQL Tests${NC}"
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

# Test 2: Direct SQL Query - Show tables
echo -e "\n${YELLOW}Test 2: Execute direct SQL query - Show tables${NC}"
echo "POST $BASE_URL/api/query/execute"
# This isn't using the NLP service but we need to format it this way for the controller
QUERY_PAYLOAD='{
  "text": "SHOW TABLES", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
echo "Payload: $QUERY_PAYLOAD"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$QUERY_PAYLOAD")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 3: Direct SQL Query - Select from DATASOURCES
echo -e "\n${YELLOW}Test 3: Execute direct SQL query - Select from DATASOURCES${NC}"
echo "POST $BASE_URL/api/query/execute"
QUERY_PAYLOAD='{
  "text": "SELECT * FROM DATASOURCES", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
echo "Payload: $QUERY_PAYLOAD"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$QUERY_PAYLOAD")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

echo -e "\n${YELLOW}All tests completed!${NC}"
