#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Creating Sample Data for QueryLens Testing${NC}"
echo "================================================="

# Set the base URL and datasource ID
BASE_URL="http://localhost:8085"
DATASOURCE_ID=1

# Drop the sample_data table if it exists
echo -e "\n${YELLOW}Dropping existing sample_data table if it exists${NC}"
QUERY="DROP TABLE IF EXISTS SAMPLE_DATA"
curl -s -X POST "$BASE_URL/api/query/execute-sql?datasourceId=$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY"
echo -e "${GREEN}Table dropped${NC}"

# Create the sample_data table
echo -e "\n${YELLOW}Creating sample_data table${NC}"
QUERY="CREATE TABLE SAMPLE_DATA (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50),
    category VARCHAR(50),
    \"value\" DECIMAL(10,2),
    created_date DATE
)"
curl -s -X POST "$BASE_URL/api/query/execute-sql?datasourceId=$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY"
echo -e "${GREEN}Table created${NC}"

# Insert sample data
echo -e "\n${YELLOW}Inserting sample data${NC}"
QUERY="INSERT INTO SAMPLE_DATA (name, category, \"value\", created_date) VALUES
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
curl -s -X POST "$BASE_URL/api/query/execute-sql?datasourceId=$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY"
echo -e "${GREEN}Sample data inserted${NC}"

# Verify sample data was created correctly
echo -e "\n${YELLOW}Verifying sample data${NC}"
QUERY="SELECT COUNT(*) AS count FROM SAMPLE_DATA"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute-sql?datasourceId=$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")
COUNT=$(echo "$RESPONSE" | jq '.data[0].COUNT')
echo -e "${GREEN}Count of sample data records: $COUNT${NC}"

# Show some sample data
echo -e "\n${YELLOW}Sample data preview${NC}"
QUERY="SELECT * FROM SAMPLE_DATA LIMIT 3"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/query/execute-sql?datasourceId=$DATASOURCE_ID" \
  -H "Content-Type: text/plain" \
  --data-binary "$QUERY")
echo -e "${GREEN}Sample data:${NC}"
echo "$RESPONSE" | jq '.data'

echo -e "\n${YELLOW}Sample data initialization complete!${NC}"
echo "================================================="
