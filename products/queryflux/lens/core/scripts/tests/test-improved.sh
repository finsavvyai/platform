#!/bin/bash
# Improved test script for QueryLens that directly tests the query capabilities

# Set the base URL
BASE_URL="http://localhost:8082"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing QueryLens Query Service${NC}"
echo "================================================="

# Test 0: Get datasource information
echo -e "\n${YELLOW}Test 0: Getting datasource information${NC}"
echo "GET $BASE_URL/api/datasources"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/datasources" -H "Content-Type: application/json")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Extract the first datasource ID
DATASOURCE_ID=$(echo $RESPONSE | jq '.[0].id' 2>/dev/null || echo 1)
echo -e "\n${YELLOW}Using datasource ID: $DATASOURCE_ID${NC}"

# Test 1: Direct SQL query to test database structure
echo -e "\n${YELLOW}Test 1: Direct SQL query - Database structure${NC}"
echo "POST $BASE_URL/api/test/query/$DATASOURCE_ID"
QUERY="SHOW TABLES"
echo "Query: $QUERY"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  -d "$QUERY")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 2: Direct SQL query to examine datasources table
echo -e "\n${YELLOW}Test 2: Direct SQL query - Examine datasources table${NC}"
echo "POST $BASE_URL/api/test/query/$DATASOURCE_ID"
QUERY="SELECT * FROM DATASOURCES"
echo "Query: $QUERY"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  -d "$QUERY")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 3: Direct SQL query to test H2 system tables
echo -e "\n${YELLOW}Test 3: Direct SQL query - H2 system tables${NC}"
echo "POST $BASE_URL/api/test/query/$DATASOURCE_ID"
QUERY="SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC'"
echo "Query: $QUERY"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  -d "$QUERY")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 4: Add sample data to test queries against
echo -e "\n${YELLOW}Test 4: Add sample data for testing${NC}"
echo "POST $BASE_URL/api/test/query/$DATASOURCE_ID"
QUERY="CREATE TABLE IF NOT EXISTS sample_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50),
    category VARCHAR(50),
    value DECIMAL(10,2),
    created_date DATE
)"
echo "Query: $QUERY"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  -d "$QUERY")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 5: Insert sample data
echo -e "\n${YELLOW}Test 5: Insert sample data${NC}"
echo "POST $BASE_URL/api/test/query/$DATASOURCE_ID"
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
echo "Query: $QUERY"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  -d "$QUERY")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 6: Send a test query to check sample data
echo -e "\n${YELLOW}Test 6: Check sample data${NC}"
echo "POST $BASE_URL/api/test/query/$DATASOURCE_ID"
QUERY="SELECT * FROM sample_data"
echo "Query: $QUERY"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/test/query/$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  -d "$QUERY")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

# Test 7: Now test the natural language query with all pieces in place
echo -e "\n${YELLOW}Test 7: Natural language query - Count by category${NC}"
echo "POST $BASE_URL/api/query/execute"
QUERY_PAYLOAD='{
  "text": "Count products by category", 
  "datasourceId": '"$DATASOURCE_ID"'
}'
echo "Payload: $QUERY_PAYLOAD"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute" \
  -H "Content-Type: application/json" \
  -d "$QUERY_PAYLOAD")
echo -e "${GREEN}Response:${NC}"
echo $RESPONSE | jq '.' 2>/dev/null || echo $RESPONSE

echo -e "\n${YELLOW}All tests completed!${NC}"
