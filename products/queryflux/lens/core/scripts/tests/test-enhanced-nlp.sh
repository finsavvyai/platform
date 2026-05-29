#!/bin/bash
# Comprehensive test script for enhanced QueryLens NLP capabilities

# Set the base URL
BASE_URL="http://localhost:8085"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Enhanced QueryLens NLP Capabilities Test${NC}"
echo "================================================="

# Get datasource information
echo -e "\n${BLUE}Getting datasource information${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/datasources" -H "Content-Type: application/json")
DATASOURCE_ID=$(echo $RESPONSE | jq '.[0].id' 2>/dev/null || echo 1)
echo -e "${GREEN}Using datasource ID: $DATASOURCE_ID${NC}"

# Verify sample data exists
echo -e "\n${BLUE}Verifying sample data${NC}"
QUERY="SELECT COUNT(*) AS count FROM SAMPLE_DATA"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")
COUNT=$(echo $RESPONSE | jq '.results[0].COUNT' 2>/dev/null)
echo -e "${GREEN}Sample data count: $COUNT records${NC}"

# TEST GROUP 1: FILTERING CAPABILITIES
echo -e "\n${YELLOW}=== TEST GROUP 1: FILTERING CAPABILITIES ===${NC}"

# Test 1: Basic filtering by category
echo -e "\n${BLUE}Test 1: Basic filtering by category${NC}"
echo -e "${GREEN}Query: Find products in Electronics category${NC}"
PAYLOAD='{
  "text": "Find products in Electronics category", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.success, .generatedSql, .data[] | select(.CATEGORY == "Electronics")' 2>/dev/null || echo $RESPONSE

# Test 2: Category filtering with explicit value
echo -e "\n${BLUE}Test 2: Category filtering with explicit value${NC}"
echo -e "${GREEN}Query: Show me Furniture products${NC}"
PAYLOAD='{
  "text": "Show me Furniture products", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.success, .generatedSql, .data[] | select(.CATEGORY == "Furniture")' 2>/dev/null || echo $RESPONSE

# TEST GROUP 2: AGGREGATION CAPABILITIES
echo -e "\n${YELLOW}=== TEST GROUP 2: AGGREGATION CAPABILITIES ===${NC}"

# Test 3: Count by category
echo -e "\n${BLUE}Test 3: Count by category${NC}"
echo -e "${GREEN}Query: Count products by category${NC}"
PAYLOAD='{
  "text": "Count products by category", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.success, .generatedSql, .data' 2>/dev/null || echo $RESPONSE

# Test 4: Sum value by category
echo -e "\n${BLUE}Test 4: Sum value by category${NC}"
echo -e "${GREEN}Query: Sum product values by category${NC}"
PAYLOAD='{
  "text": "Sum product values by category", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.success, .generatedSql, .data' 2>/dev/null || echo $RESPONSE

# TEST GROUP 3: TRENDING CAPABILITIES
echo -e "\n${YELLOW}=== TEST GROUP 3: TRENDING CAPABILITIES ===${NC}"

# Test 5: Trend over time
echo -e "\n${BLUE}Test 5: Trend over time${NC}"
echo -e "${GREEN}Query: Show product sales trend by date${NC}"
PAYLOAD='{
  "text": "Show product sales trend by date", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.success, .generatedSql, .data' 2>/dev/null || echo $RESPONSE

# TEST GROUP 4: COMPARISON CAPABILITIES
echo -e "\n${YELLOW}=== TEST GROUP 4: COMPARISON CAPABILITIES ===${NC}"

# Test 6: Compare categories
echo -e "\n${BLUE}Test 6: Compare categories${NC}"
echo -e "${GREEN}Query: Compare product values across categories${NC}"
PAYLOAD='{
  "text": "Compare product values across categories", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.success, .generatedSql, .data' 2>/dev/null || echo $RESPONSE

echo -e "\n${YELLOW}All enhanced NLP query tests completed!${NC}"
echo "==================================================="
