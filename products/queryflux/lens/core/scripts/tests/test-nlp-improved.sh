#!/bin/bash
# Improved test script for QueryLens NLP capabilities

# Set the base URL
BASE_URL="http://localhost:8085"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}QueryLens NLP Query Test${NC}"
echo "================================================="

# Get datasource information
echo -e "\n${YELLOW}Getting datasource information${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/datasources" -H "Content-Type: application/json")
DATASOURCE_ID=$(echo $RESPONSE | jq '.[0].id' 2>/dev/null || echo 1)
echo -e "${GREEN}Using datasource ID: $DATASOURCE_ID${NC}"

# Setup test data
echo -e "\n${YELLOW}Setting up test data${NC}"
echo -e "${GREEN}Creating sample_data table${NC}"
QUERY="DROP TABLE IF EXISTS sample_data;
CREATE TABLE sample_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50),
    category VARCHAR(50),
    value DECIMAL(10,2),
    created_date DATE
)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")

echo -e "${GREEN}Inserting sample data${NC}"
QUERY="INSERT INTO sample_data (name, category, value, created_date) VALUES
    ('Product A', 'Electronics', 150.50, '2023-01-01'),
    ('Product B', 'Electronics', 200.75, '2023-01-05'),
    ('Product C', 'Furniture', 350.25, '2023-01-10'),
    ('Product D', 'Furniture', 120.00, '2023-01-15'),
    ('Product E', 'Clothing', 75.99, '2023-01-20'),
    ('Product F', 'Clothing', 45.50, '2023-01-25'),
    ('Product G', 'Electronics', 500.00, '2023-02-01'),
    ('Product H', 'Furniture', 250.00, '2023-02-05'),
    ('Product I', 'Clothing', 60.75, '2023-02-10'),
    ('Product J', 'Electronics', 350.25, '2023-02-15')"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")

# Verify sample data was created correctly
echo -e "${GREEN}Verifying sample data${NC}"
QUERY="SELECT * FROM sample_data LIMIT 3"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")
echo -e "${GREEN}Sample data preview:${NC}"
echo $RESPONSE | jq '.data' 2>/dev/null || echo $RESPONSE

# Test 1: Simple aggregation query
echo -e "\n${YELLOW}Test 1: Simple aggregation query${NC}"
echo -e "${GREEN}Query: Count all products in sample data${NC}"
PAYLOAD='{
  "text": "Count all products in sample data", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.success, .generatedSql, .data' 2>/dev/null || echo $RESPONSE

# Test 2: Aggregation by category
echo -e "\n${YELLOW}Test 2: Aggregation by category${NC}"
echo -e "${GREEN}Query: Count products by category in sample data${NC}"
PAYLOAD='{
  "text": "Count products by category in sample data", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.success, .generatedSql, .data' 2>/dev/null || echo $RESPONSE

# Test 3: Sum values by category
echo -e "\n${YELLOW}Test 3: Sum values by category${NC}"
echo -e "${GREEN}Query: Sum value by category in sample data${NC}"
PAYLOAD='{
  "text": "Sum value by category in sample data", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.success, .generatedSql, .data' 2>/dev/null || echo $RESPONSE

# Test 4: Trending query
echo -e "\n${YELLOW}Test 4: Trending query${NC}"
echo -e "${GREEN}Query: Show product sales trend by date in sample data${NC}"
PAYLOAD='{
  "text": "Show product sales trend by date in sample data", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.success, .generatedSql, .data' 2>/dev/null || echo $RESPONSE

# Test 5: Filter query
echo -e "\n${YELLOW}Test 5: Filter query${NC}"
echo -e "${GREEN}Query: Find products in Electronics category in sample data${NC}"
PAYLOAD='{
  "text": "Find products in Electronics category in sample data", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.success, .generatedSql, .data' 2>/dev/null || echo $RESPONSE

echo -e "\n${YELLOW}All NLP query tests completed!${NC}"
