#!/bin/bash
# Test script for QueryLens API

# Set the base URL
BASE_URL="http://localhost:8081"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing QueryLens API${NC}"
echo "================================================="

# Test 1: Get all datasources
echo -e "\n${YELLOW}Test 1: Getting all datasources${NC}"
echo "GET $BASE_URL/api/datasources"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/datasources" -H "Content-Type: application/json")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 2: Create a new datasource
echo -e "\n${YELLOW}Test 2: Creating a new datasource${NC}"
echo "POST $BASE_URL/api/datasources"
DATASOURCE_PAYLOAD='{
  "name": "Test Database",
  "description": "A database for testing purposes",
  "url": "jdbc:h2:mem:testdb",
  "username": "sa",
  "password": "",
  "driverClassName": "org.h2.Driver"
}'
echo "Payload: $DATASOURCE_PAYLOAD"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/datasources" \
  -H "Content-Type: application/json" \
  -d "$DATASOURCE_PAYLOAD")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Get the datasource ID from response
DATASOURCE_ID=1  # Default to 1 if parsing fails

# Test 3: Get datasource by ID
echo -e "\n${YELLOW}Test 3: Getting datasource by ID${NC}"
echo "GET $BASE_URL/api/datasources/$DATASOURCE_ID"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/datasources/$DATASOURCE_ID" \
  -H "Content-Type: application/json")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 4: Execute aggregation query
echo -e "\n${YELLOW}Test 4: Execute aggregation query${NC}"
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

# Test 5: Execute filtering query
echo -e "\n${YELLOW}Test 5: Execute filtering query${NC}"
echo "POST $BASE_URL/api/query/execute"
QUERY_PAYLOAD='{
  "text": "Find records where name equals John", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
echo "Payload: $QUERY_PAYLOAD"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$QUERY_PAYLOAD")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 6: Execute comparison query
echo -e "\n${YELLOW}Test 6: Execute comparison query${NC}"
echo "POST $BASE_URL/api/query/execute"
QUERY_PAYLOAD='{
  "text": "Compare values by category", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
echo "Payload: $QUERY_PAYLOAD"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$QUERY_PAYLOAD")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 7: Execute trending query
echo -e "\n${YELLOW}Test 7: Execute trending query${NC}"
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

echo -e "\n${YELLOW}All tests completed!${NC}"
